import { useMemo, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  listResource,
  detailResource,
  filterResource,
  equals,
} from "../lib/resources";
import {
  ClipboardCheck,
  ChefHat,
  CheckCircle2,
  Hand,
  LayoutDashboard,
  LogOut,
  Menu,
  Printer,
  QrCode,
  ScanLine,
  ShoppingCart,
  User,
  Wallet,
  X,
} from "lucide-react";
import { useSession } from "../lib/auth";
import { useDoc, useLive } from "../lib/live";
import { call } from "../lib/api";
import {
  Brand,
  Empty,
  LiveBadge,
  PageTitle,
  Pill,
  RoleBadge,
  Stat,
} from "../components/UI";
import { AccountDialog } from "../components/Account";
import { KioskOverview } from "../components/Kiosks";
import { useArrivals, useChime } from "../lib/alerts";
import { money, profileLabel, timestamp } from "../lib/types";
import type { Business, Branch, Order } from "../lib/types";
import { Scanner } from "./Scanner";
import DayReport from "../components/DayReport";
import { useConfig } from "../lib/config";
import { printKitchenTicket } from "../lib/printing";
import "../components/PaymentSimulator.css";

type Section =
  "overview" | "cash" | "collection" | "history" | "closeout";
const sectionNames: Record<Section, string> = {
  overview: "Cashier overview",
  cash: "Cash payment queue",
  collection: "Order handover",
  history: "Transactions & receipts",
  closeout: "End-of-day report",
};
const icons: Record<Section, ReactNode> = {
  overview: <LayoutDashboard />,
  cash: <Wallet />,
  collection: <ChefHat />,
  history: <ClipboardCheck />,
  closeout: <Printer />,
};
export default function Cashier() {
  const { config: appConfig } = useConfig(),
    isSim = appConfig.payments.simulated;
  const me = useSession(),
    go = useNavigate(),
    superAdmin = me.role === "super_admin";
  const [cashReview, setCashReview] = useState<Order | null>(null),
    [cashFind, setCashFind] = useState(""),
    [cashScan, setCashScan] = useState(false),
    [cashTendered, setCashTendered] = useState(""),
    [account, setAccount] = useState(false),
    [notice, setNotice] = useState("");
  const chime = useChime("sstwas-cashier-chime");
  const [view, setView] = useState<Section>("overview"),
    [chosenStore, setChosenStore] = useState(me.businessId || ""),
    [chosenBranch, setChosenBranch] = useState(""),
    [menu, setMenu] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false);
  const allRef = useMemo(
    () => (superAdmin ? listResource("businesses") : null),
    [superAdmin],
  );
  const { items: allStores, error: allErr } = useLive<Business>(allRef, [
    superAdmin,
  ]);
  const ownRef = useMemo(
    () =>
      !superAdmin && me.businessId
        ? detailResource("businesses", me.businessId)
        : null,
    [superAdmin, me.businessId],
  );
  const { value: ownStore, error: ownErr } = useDoc<Business>(ownRef, [
    superAdmin,
    me.businessId,
  ]);
  const stores = superAdmin ? allStores : ownStore ? [ownStore] : [];
  const storeId = superAdmin ? chosenStore : me.businessId || "";
  const store = stores.find((s) => s.id === storeId);
  const branchRef = useMemo(
    () => (storeId ? listResource("businesses", storeId, "branches") : null),
    [storeId],
  );
  const { items: branches } = useLive<Branch>(branchRef, [storeId]);
  const branchId =
    me.role === "cashier"
      ? me.branchId || ""
      : branches.find((b) => b.id === chosenBranch)
        ? chosenBranch
        : branches[0]?.id || "";
  useEffect(() => {
    setChosenBranch("");
  }, [storeId]);
  const ordersRef = useMemo(
    () =>
      storeId && branchId
        ? filterResource(
            listResource("businesses", storeId, "orders"),
            equals("branchId", branchId),
          )
        : null,
    [storeId, branchId],
  );
  const {
    items: orders,
    error: orderErr,
    synced,
  } = useLive<Order>(ordersRef, [storeId, branchId]);
  const pendingAll = orders.filter((o) => o.status === "pending_cash");
  const needle = cashFind.trim().replace(/^#/, "").replace(/\D/g, "");
  const pending = needle
    ? pendingAll.filter(
        (o) => o.payNumber?.replace(/\D/g, "") === needle,
      )
    : pendingAll;
  const tenderedMinor = Math.round((Number(cashTendered) || 0) * 100);
  const cashChange = cashReview
    ? Math.max(0, tenderedMinor - cashReview.totalMinor)
    : 0;
  const cashTenderedEnough =
    !!cashReview && tenderedMinor >= cashReview.totalMinor;
  const paid = orders.filter((o) => o.status === "paid");
  const queue = paid.filter((o) => o.fulfillment !== "collected");
  const isFood = store?.profile === "food";
  const isGrocery = store?.profile === "grocery";
  const readyForHandover = queue.filter((o) => o.fulfillment === "ready");
  const inKitchen = queue.filter(
    (o) => o.fulfillment === "new" || o.fulfillment === "preparing",
  );
  // Food: the Kitchen display marks orders Ready; the Cashier is alerted here and hands over. Fashion: the cashier runs every step.
  useArrivals(
    readyForHandover.map((o) => o.id),
    synced !== null && !!isFood,
    (fresh) => {
      chime.play();
      setNotice(
        `Order #${(() => {
          const order = orders.find((o) => o.id === fresh[0]);
          return order?.payNumber || order?.id.slice(-7).toUpperCase() || "";
        })()}${fresh.length > 1 ? ` and ${fresh.length - 1} more` : ""} is ready for handover`,
      );
      setTimeout(() => setNotice(""), 7000);
    },
  );
  const run = async (
    name: string,
    data: Record<string, unknown>,
    msg: string,
  ) => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await call(name, { businessId: storeId, branchId, ...data });
      setSuccess(msg);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const reverseSale = async (
    orderId: string,
    type: "refundOrder" | "voidOrder",
  ) => {
    const reason = window.prompt(
      type === "refundOrder"
        ? "Reason for refund?"
        : "Reason for voiding this sale?",
    );
    if (!reason?.trim()) return;
    await run(
      type,
      { orderId, reason: reason.trim() },
      type === "refundOrder"
        ? "Sale refunded and stock restored"
        : "Sale voided and stock restored",
    );
  };
  const change = (s: Section) => {
    setView(s);
    setMenu(false);
    setError("");
    setSuccess("");
  };
  useEffect(() => {
    if (isGrocery && view === "collection") setView("overview");
  }, [isGrocery, view]);
  const menuItems: Section[] = isGrocery
    ? ["overview", "cash", "history", "closeout"]
    : ["overview", "cash", "collection", "history", "closeout"];
  const nextState: Record<string, "preparing" | "ready" | "collected"> = {
    new: "preparing",
    preparing: "ready",
    ready: "collected",
  };
  return (
    <div className="workspace-shell cashier-workspace">
      <aside className={"workspace-nav " + (menu ? "open" : "")}>
        <div className="side-brand">
          <Brand />
          <button
            className="nav-close"
            onClick={() => setMenu(false)}
            aria-label="Close"
          >
            <X />
          </button>
        </div>
        <div className="role-label">
          <Wallet size={17} /> CASHIER STATION
        </div>
        <span className="sidebar-label">OPERATIONS</span>
        <nav>
          {menuItems.map((s) => (
            <button
              className={view === s ? "active" : ""}
              key={s}
              onClick={() => change(s)}
            >
              {icons[s]}
              <span>{sectionNames[s]}</span>
              {s === "cash" && pending.length > 0 && (
                <b className="queue-count">{pending.length}</b>
              )}
              {s === "collection" &&
                (isFood ? readyForHandover.length : queue.length) > 0 && (
                  <b className="queue-count ready">
                    {isFood ? readyForHandover.length : queue.length}
                  </b>
                )}
            </button>
          ))}
        </nav>
        <div className="nav-footer">
          <button onClick={() => setAccount(true)}>
            <User size={16} /> My account
          </button>
          {me.role !== "cashier" && <Link to="/admin">Back to Admin</Link>}
          {isFood && me.role !== "cashier" && (
            <Link to="/kitchen">Open Kitchen display</Link>
          )}
          <button onClick={() => void me.logout().then(() => go("/cashier"))}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="workspace-toolbar">
          <button className="menu-toggle" onClick={() => setMenu(true)}>
            <Menu />
          </button>
          <div className="breadcrumbs">
            TILLCORE <span>/</span> CASHIER <span>/</span>{" "}
            <b>{sectionNames[view]}</b>
          </div>
          <span className="toolbar-user">
            <LiveBadge synced={synced} error={orderErr} />
            {me.role && <RoleBadge role={me.role} />}
            {me.user?.displayName || me.user?.email}
          </span>
        </header>
        <main className="workspace-content">
          <PageTitle
            eyebrow="STORE CHECKOUT OPERATIONS"
            title={sectionNames[view]}
            description={
              isGrocery
                ? "Confirm cash payments and assist shoppers at checkout."
                : "Confirm cash payments, assist shoppers and hand over completed orders."
            }
          />
          {(error || orderErr || allErr || ownErr) && (
            <p className="error" role="alert">
              {error || orderErr || allErr || ownErr}
            </p>
          )}
          {notice && (
            <p className="success-toast ready-notice" role="status">
              <Hand size={17} />
              {notice}
              <button onClick={() => setNotice("")} aria-label="Dismiss">
                ×
              </button>
            </p>
          )}
          {success && (
            <p className="success-toast" role="status">
              <CheckCircle2 size={17} />
              {success}
              <button onClick={() => setSuccess("")} aria-label="Dismiss">
                ×
              </button>
            </p>
          )}
          {superAdmin && (
            <div className="workspace-selector">
              <label className="field">
                Store
                <select
                  value={storeId}
                  onChange={(e) => setChosenStore(e.target.value)}
                >
                  <option value="">Select store</option>
                  {stores.map((b) => (
                    <option value={b.id} key={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {branches.length > 1 && me.role !== "cashier" && (
            <div className="workspace-selector">
              <label className="field">
                Location
                <select
                  value={branchId}
                  onChange={(e) => setChosenBranch(e.target.value)}
                >
                  {branches.map((b) => (
                    <option value={b.id} key={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {!storeId || !branchId ? (
            <Empty
              title="Choose your checkout store"
              detail="A store and checkout location are required."
            />
          ) : (
            <>
              {view === "overview" && (
                <>
                  <div
                    className={`metrics-grid ${isGrocery ? "metrics-3" : "metrics-5"}`}
                  >
                    <Stat label="Pending cash" value={pending.length} />
                    <Stat label="Paid checkouts" value={paid.length} />
                    <Stat
                      label="Recorded total"
                      value={money(paid.reduce((n, o) => n + o.totalCents, 0))}
                    />
                    {!isGrocery && (
                      <>
                        <Stat
                          label={isFood ? "In kitchen" : "To prepare"}
                          value={inKitchen.length}
                        />
                        <Stat
                          label="Ready for handover"
                          value={readyForHandover.length}
                        />
                      </>
                    )}
                  </div>
                  <KioskOverview storeId={storeId} />
                  <section className="panel">
                    <div className="panel-head">
                      <div>
                        <h2>{store?.name} checkout</h2>
                        <p>
                          {store ? profileLabel(store.profile) : ""} •
                          Touch-friendly cashier tools
                        </p>
                      </div>
                    </div>
                    <div className="quick-workflow">
                      <article>
                        <Wallet />
                        <h3>Confirm cash</h3>
                        <p>Review orders sent from phones or kiosks.</p>
                        <button
                          className="btn btn-primary"
                          onClick={() => change("cash")}
                        >
                          Open queue
                        </button>
                      </article>
                      {!isGrocery && (
                        <article>
                          <QrCode />
                          <h3>Order handover</h3>
                          <p>
                            {isFood
                              ? "Hand over orders the kitchen has marked ready."
                              : "Prepare and hand over fashion orders."}
                          </p>
                          <button
                            className="btn btn-outline"
                            onClick={() => change("collection")}
                          >
                            Open
                          </button>
                        </article>
                      )}
                    </div>
                  </section>
                </>
              )}
              {view === "cash" && (
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>Awaiting cash payments</h2>
                      <p>
                        Only confirm after you have received the customer's
                        cash.
                      </p>
                    </div>
                  </div>
                  <div className="cash-find">
                    <input
                      value={cashFind}
                      onChange={(e) => setCashFind(e.target.value)}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Enter pay number, e.g. 0147"
                      aria-label="Find by cash pay number"
                    />
                    <button
                      className="btn btn-outline"
                      onClick={() => setCashScan((v) => !v)}
                    >
                      <ScanLine size={16} /> Scan customer QR
                    </button>
                    {cashFind && (
                      <button
                        className="btn btn-outline"
                        onClick={() => setCashFind("")}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {cashScan && (
                    <Scanner
                      caption="Scan the QR on the customer's phone"
                      onScan={(v) => {
                        setCashFind(v);
                        setCashScan(false);
                      }}
                    />
                  )}
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Order</th>
                          <th>Where</th>
                          <th>Items</th>
                          <th>Amount</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pending.map((o) => (
                          <tr key={o.id}>
                            <td>
                              <code className="cash-pay-code">#{o.payNumber || "----"}</code>
                            </td>
                            <td>
                              {o.source === "kiosk"
                                ? `Kiosk${o.kioskName ? ` · ${o.kioskName}` : ""}`
                                : o.source === "pos"
                                  ? "Cashier POS"
                                  : "Customer phone"}
                            </td>
                            <td>
                              {o.items
                                .map((i) => `${i.quantity} × ${i.name}`)
                                .join(", ")}
                            </td>
                            <td>{money(o.totalMinor, o.currency)}</td>
                            <td>
                              <div className="table-actions">
                                <button
                                  disabled={busy}
                                  onClick={() => {
                                    setCashTendered(
                                      (o.totalMinor / 100).toFixed(2),
                                    );
                                    setCashReview(o);
                                  }}
                                >
                                  Confirm cash
                                </button>
                                <button
                                  disabled={busy}
                                  onClick={() =>
                                    void run(
                                      "cancelCash",
                                      { orderId: o.id },
                                      "Order cancelled",
                                    )
                                  }
                                >
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!pending.length && (
                    <Empty
                      title={
                        pendingAll.length
                          ? "No pending order matches"
                          : "No cash payments waiting"
                      }
                    />
                  )}
                </section>
              )}
              {view === "collection" && isFood && (
                <>
                  <section className="panel">
                    <div className="panel-head">
                      <div>
                        <h2>Ready for handover</h2>
                        <p>
                          The Kitchen display marked these orders ready. Give
                          the order to the customer, then mark it collected.
                        </p>
                      </div>
                    </div>
                    <div className="order-grid">
                      {readyForHandover.map((o) => (
                        <article className="order-ticket handover" key={o.id}>
                          <div>
                            <span className="eyebrow">
                              ORDER #{o.payNumber || o.id.slice(-7).toUpperCase()}
                            </span>
                            <Pill text="ready" />
                          </div>
                          <h3>
                            {o.items
                              .map((i) => `${i.quantity} × ${i.name}`)
                              .join(", ")}
                          </h3>
                          <p>
                            {o.serviceType === "dine_in"
                              ? "Dine in"
                              : "Takeaway"}{" "}
                            · {timestamp(o.createdAt)}
                          </p>
                          {o.orderNote && (
                            <p className="order-note">
                              Special instructions: {o.orderNote}
                            </p>
                          )}
                          <button
                            className="btn btn-primary btn-full"
                            disabled={busy}
                            onClick={() =>
                              void run(
                                "updateFulfillment",
                                { orderId: o.id, fulfillment: "collected" },
                                "Order handed over",
                              )
                            }
                          >
                            <Hand size={16} /> Mark collected
                          </button>
                        </article>
                      ))}
                    </div>
                    {!readyForHandover.length && (
                      <Empty
                        title="No orders waiting for handover"
                        detail="They appear here the moment the kitchen marks them ready."
                      />
                    )}
                  </section>
                  <section className="panel">
                    <div className="panel-head">
                      <div>
                        <h2>Being prepared in the kitchen</h2>
                        <p>Read-only status from the Kitchen display.</p>
                      </div>
                      <Link className="smallbtn" to="/kitchen">
                        <ChefHat size={14} /> Open Kitchen display
                      </Link>
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Order</th>
                            <th>Items</th>
                            <th>Type</th>
                            <th>Kitchen status</th>
                            <th>Ticket</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inKitchen.map((o) => (
                            <tr key={o.id}>
                              <td>
                                <code>#{o.payNumber || o.id.slice(-7).toUpperCase()}</code>
                              </td>
                              <td>
                                {o.items
                                  .map((i) => `${i.quantity} × ${i.name}`)
                                  .join(", ")}
                              </td>
                              <td>
                                {o.serviceType === "dine_in"
                                  ? "Dine in"
                                  : "Takeaway"}
                              </td>
                              <td>
                                <Pill text={o.fulfillment} />
                              </td>
                              <td>
                                {store && (
                                  <button
                                    className="smallbtn"
                                    onClick={() =>
                                      printKitchenTicket(o, store.name)
                                    }
                                  >
                                    <Printer size={14} /> Print
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!inKitchen.length && (
                      <Empty title="Kitchen queue is clear" />
                    )}
                  </section>
                </>
              )}
              {view === "collection" && !isFood && (
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>Fashion pickup queue</h2>
                      <p>
                        Paid orders move from New → Preparing → Ready →
                        Collected.
                      </p>
                    </div>
                  </div>
                  <div className="order-grid">
                    {queue.map((o) => (
                      <article className="order-ticket" key={o.id}>
                        <div>
                          <span className="eyebrow">
                            ORDER #{o.payNumber || o.id.slice(-7).toUpperCase()}
                          </span>
                          <Pill text={o.fulfillment} />
                        </div>
                        <h3>
                          {o.items
                            .map(
                              (i) =>
                                `${i.quantity} × ${i.name}${i.variantName === "Standard" ? "" : ` (${i.variantName})`}`,
                            )
                            .join(", ")}
                        </h3>
                        <p>{timestamp(o.createdAt)}</p>
                        <button
                          className="btn btn-primary btn-full"
                          disabled={busy}
                          onClick={() =>
                            void run(
                              "updateFulfillment",
                              {
                                orderId: o.id,
                                fulfillment: nextState[o.fulfillment],
                              },
                              "Order status updated",
                            )
                          }
                        >
                          Mark {nextState[o.fulfillment]}
                        </button>
                      </article>
                    ))}
                  </div>
                  {!queue.length && (
                    <Empty title="No orders awaiting collection" />
                  )}
                </section>
              )}
              {view === "history" && (
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>All store transactions</h2>
                      <p>
                        Refund or void a sale only after recording the reason.
                        Stock is restored automatically for paid sales.
                      </p>
                    </div>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Order</th>
                          <th>Date</th>
                          <th>Method</th>
                          <th>Status</th>
                          <th>Total</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...orders]
                          .sort(
                            (a, b) =>
                              new Date(b.createdAt || 0).getTime() -
                              new Date(a.createdAt || 0).getTime(),
                          )
                          .map((o) => (
                            <tr key={o.id}>
                              <td>
                                <code>{o.id.slice(0, 16)}</code>
                              </td>
                              <td>{timestamp(o.createdAt)}</td>
                              <td>{o.method}</td>
                              <td>
                                <Pill text={o.status} />
                              </td>
                              <td>{money(o.totalMinor, o.currency)}</td>{" "}
                              <td>
                                <div className="table-actions">
                                  <Link
                                    className="smallbtn"
                                    to={`/receipt/${storeId}/${o.id}`}
                                  >
                                    <Printer size={14} /> Receipt
                                  </Link>
                                  {o.status === "paid" && (
                                    <button
                                      disabled={busy}
                                      onClick={() =>
                                        void reverseSale(o.id, "refundOrder")
                                      }
                                    >
                                      Refund
                                    </button>
                                  )}
                                  {o.status === "paid" && (
                                    <button
                                      disabled={busy}
                                      onClick={() =>
                                        void reverseSale(o.id, "voidOrder")
                                      }
                                    >
                                      Void
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  {!orders.length && <Empty title="No transactions yet" />}
                </section>
              )}
              {view === "closeout" && (
                <DayReport
                  businessId={storeId}
                  branchId={branchId}
                  branchName={branches.find((b) => b.id === branchId)?.name}
                  canExport={false}
                />
              )}
            </>
          )}
        </main>
      </div>
      {account && <AccountDialog onClose={() => setAccount(false)} />}
      {cashReview && (
        <div className="cash-confirm-overlay" role="presentation">
          <section
            className="cash-confirm-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cash-confirm-title"
          >
            <span className="payment-sim-tag">
              <Wallet size={15} /> CASHIER PAYMENT{isSim ? " · SIMULATION" : ""}
            </span>
            <h2 id="cash-confirm-title">Confirm cash checkout</h2>
            <p>
              Check the items and total, enter the amount received, then confirm.
              {isSim ? " No actual money is transferred." : ""}
            </p>
            <div className="cash-confirm-receipt">
              <span>TRANSACTION</span>
              <span>PAY NUMBER</span>
              <strong className="cash-pay-number">
                #{cashReview.payNumber || "----"}
              </strong>
              <span>ORDER ITEMS</span>
              {cashReview.items.map((i) => (
                <div key={`${i.productId}-${i.variantId}`}>
                  {i.quantity} × {i.name} <small>{i.variantName}</small>
                </div>
              ))}
              <span>TOTAL TO CONFIRM</span>
              <b>{money(cashReview.totalMinor, cashReview.currency)}</b>
            </div>
            <label className="cash-tendered-field">
              <span>Amount received ({cashReview.currency})</span>
              <input
                type="number"
                min={(cashReview.totalMinor / 100).toFixed(2)}
                step="0.01"
                inputMode="decimal"
                value={cashTendered}
                onChange={(e) => setCashTendered(e.target.value)}
              />
            </label>
            <div className={`cash-change ${cashTenderedEnough ? "ready" : ""}`}>
              <span>Change to return</span>
              <strong>
                {money(cashChange, cashReview.currency)}
              </strong>
            </div>
            <div className="cash-confirm-actions">
              <button
                type="button"
                className="btn btn-outline"
                disabled={busy}
                onClick={() => setCashReview(null)}
              >
                Back to queue
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !cashTenderedEnough}
                onClick={() =>
                  void (async () => {
                    const completed = await run(
                      "confirmCash",
                      {
                        orderId: cashReview.id,
                        tenderedMinor,
                        changeMinor: cashChange,
                      },
                      "Cash payment confirmed; stock updated",
                    );
                    if (completed) setCashReview(null);
                  })()
                }
              >
                <CheckCircle2 size={17} />
                {busy ? "Confirming…" : "Confirm cash received"}
              </button>
            </div>
            <small>
              No paid receipt is issued until this confirmation succeeds.
            </small>
          </section>
        </div>
      )}
    </div>
  );
}
