import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { detailResource } from "../lib/resources";
import { useConfig } from "../lib/config";
import { QRCodeSVG } from "qrcode.react";
import { Printer, CheckCircle2, Clock3, ArrowLeft } from "lucide-react";
import { call, apiRequest } from "../lib/api";
import { useDoc } from "../lib/live";
import { money, timestamp, type Order, type Business } from "../lib/types";
import { Brand, Pill } from "../components/UI";
import { getKioskDevice } from "../lib/kiosk";
export default function Receipt() {
  const { config: appConfig } = useConfig(),
    isSim = appConfig.payments.simulated;
  const { businessId = "", orderId = "" } = useParams(),
    nav = useNavigate(),
    [error, setError] = useState("");
  const ref = useMemo(
    () => detailResource("businesses", businessId, "orders", orderId),
    [businessId, orderId],
  );
  const { value: order, error: readError } = useDoc<Order>(ref, [
    businessId,
    orderId,
  ]);
  const businessRef = useMemo(
    () => detailResource("businesses", businessId),
    [businessId],
  );
  const { value: business } = useDoc<Business>(businessRef, [businessId]);
  const finish = async () => {
    if (!order) return;
    if (order.source === "kiosk")
      await apiRequest("/auth/logout", {}).catch(() => {});
    nav(
      order.source === "kiosk"
        ? getKioskDevice()
          ? "/kiosk"
          : `/kiosk/${businessId}/${order.branchId}`
        : "/",
      { replace: true },
    );
  };
  useEffect(() => {
    if (order?.source !== "kiosk") return;
    const timer = setTimeout(() => {
      void finish();
    }, 90000);
    return () => clearTimeout(timer);
  }, [order?.id, order?.source]);
  const prevStatus = useRef<string | undefined>(undefined);
  useEffect(() => {
    const st = order?.status;
    if (prevStatus.current === "pending_cash" && st === "paid") {
      try {
        navigator.vibrate?.([120, 60, 120]);
      } catch {
        /* optional */
      }
    }
    prevStatus.current = st;
  }, [order?.status]);
  const print = async () => {
    if (!order || order.status !== "paid") return;
    setError("");
    try {
      await call("logReceiptPrint", {
        businessId,
        branchId: order.branchId,
        orderId,
      });
      window.print();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const locked = !!getKioskDevice() && (!order || order.source === "kiosk"),
    vatRate = Number(business?.vatRate || 0),
    netCents =
      vatRate > 0 && order
        ? Math.round(order.totalCents / (1 + vatRate / 100))
        : order?.totalCents || 0,
    taxCents = vatRate > 0 && order ? order.totalCents - netCents : 0;
  return (
    <>
      {locked && (
        <div className="kiosk-receipt-bar">
          <Brand locked />
        </div>
      )}
      <main className="receipt-page">
        {readError && <p className="error">{readError}</p>}
        {!order ? (
          <div className="empty">
            <h2>Loading receipt…</h2>
            <p>
              Only the shopper or authorised staff can access this transaction.
            </p>
          </div>
        ) : (
          <>
            <div className="receipt-success">
              {order.status === "paid" ? (
                <CheckCircle2 size={42} />
              ) : (
                <Clock3 size={42} />
              )}
              <h1>
                {order.status === "paid"
                  ? "Checkout complete"
                  : "Awaiting cashier"}
              </h1>
              <p>
                {order.status === "paid"
                  ? "Your transaction was recorded successfully."
                  : "Please show the order number to the cashier and pay in cash."}
              </p>
            </div>
            {order.status === "pending_cash" && (
              <div className="cash-pending" role="status">
                <span>Your cash payment number</span>
                <strong className="cash-pay-number">
                  {order.payNumber || order.id.slice(-4).toUpperCase()}
                </strong>
                <small>Give this number to the cashier</small>
                <QRCodeSVG
                  value={order.id}
                  size={150}
                  level="M"
                  includeMargin
                />
                <small>
                  {order.source === "kiosk"
                    ? "Pay at the cashier, then collect your receipt here."
                    : "Pay at the cashier. This page updates by itself the moment your payment is confirmed."}
                </small>
              </div>
            )}
            <div className="receipt-paper">
              <h2>{business?.name || "Tillcore"}</h2>
              {business?.address && (
                <p className="receipt-center">{business.address}</p>
              )}
              {business?.phone && (
                <p className="receipt-center">{business.phone}</p>
              )}
              {business?.taxNumber && (
                <p className="receipt-center">Tax No: {business.taxNumber}</p>
              )}
              <p className="receipt-center">SELF-SERVICE CHECKOUT RECEIPT</p>
              {isSim && (
                <p className="receipt-watermark">
                  DEMO TRANSACTION · NO REAL PAYMENT
                </p>
              )}
              <div className="receipt-break" />
              <div className="receipt-line">
                <span>Order</span>
                <b>{order.id}</b>
              </div>
              <div className="receipt-line">
                <span>Date</span>
                <span>{timestamp(order.createdAt)}</span>
              </div>
              <div className="receipt-line">
                <span>Source</span>
                <span>{order.source}</span>
              </div>
              <div className="receipt-line">
                <span>Payment</span>
                <span>
                  {order.method.toUpperCase()}
                  {isSim ? " (SIMULATED)" : ""}
                </span>
              </div>
              <div className="receipt-line">
                <span>Status</span>
                <Pill text={order.status} />
              </div>
              {order.serviceType && (
                <div className="receipt-line">
                  <span>Order type</span>
                  <b>
                    {order.serviceType === "dine_in" ? "Dine in" : "Takeaway"}
                  </b>
                </div>
              )}
              {order.orderNote && (
                <div className="receipt-line">
                  <span>Instructions</span>
                  <b>{order.orderNote}</b>
                </div>
              )}
              <div className="receipt-break" />
              {order.items.map((i) => (
                <div
                  key={`${i.productId}_${i.variantId}`}
                  className="receipt-item"
                >
                  <span>
                    {i.name}
                    <small>
                      {i.variantName} × {i.quantity}
                    </small>
                  </span>
                  <b>{money(i.lineCents)}</b>
                </div>
              ))}
              <div className="receipt-break" />
              <div className="receipt-line receipt-amount">
                <span>Net amount</span>
                <b>{money(netCents)}</b>
              </div>
              {vatRate > 0 && (
                <div className="receipt-line">
                  <span>VAT / sales tax ({vatRate}%)</span>
                  <b>{money(taxCents)}</b>
                </div>
              )}
              <div className="receipt-line receipt-amount">
                <span>Total in USD</span>
                <b>{money(order.totalCents)}</b>
              </div>
              <div className="receipt-line receipt-amount">
                <span>Total in {order.currency}</span>
                <b>{money(order.totalMinor, order.currency)}</b>
              </div>
              <p className="receipt-center small">
                Exchange rate snapshot: 1 USD = {order.rate} {order.currency}
              </p>
              {order.status === "paid" && (
                <div className="receipt-code">
                  <QRCodeSVG value={order.id} size={124} level="M" />
                  <strong>{order.id}</strong>
                  <small>
                    {business?.profile === "grocery"
                      ? "Show cashier for exit verification"
                      : business?.profile === "food"
                        ? "Show cashier when collecting food"
                        : "Present when collecting clothing"}
                  </small>
                </div>
              )}
              {order.status === "refunded" && (
                <p className="receipt-center">
                  <strong>REFUNDED</strong>
                  <br />
                  Reason: {order.adjustmentReason}
                </p>
              )}
              {order.status === "voided" && (
                <p className="receipt-center">
                  <strong>VOIDED</strong>
                  <br />
                  Reason: {order.adjustmentReason}
                </p>
              )}
              <p className="receipt-center">
                {business?.receiptFooter || "Thank you for shopping with us."}
              </p>
            </div>
            {error && <p className="error">{error}</p>}
            {order.status === "paid" && (
              <button
                className="btn btn-primary receipt-print"
                onClick={() => void print()}
              >
                <Printer size={18} /> Print physical receipt
              </button>
            )}
            {order.status === "paid" && order.source !== "kiosk" && (
              <button
                className="btn btn-outline receipt-print"
                onClick={() =>
                  nav(`/shop/${businessId}/${order.branchId}`, {
                    replace: true,
                  })
                }
              >
                <ArrowLeft size={18} /> Back to shop
              </button>
            )}
            {order.source === "kiosk" && (
              <button
                className="btn btn-outline receipt-print"
                onClick={() => void finish()}
              >
                {locked
                  ? "Finish — next customer"
                  : "Finish and clear kiosk session"}
              </button>
            )}
            <p className="fineprint receipt-note">
              Choose your connected thermal printer in the browser print dialog
              for an 80 mm printed receipt.
            </p>
          </>
        )}
      </main>
    </>
  );
}
