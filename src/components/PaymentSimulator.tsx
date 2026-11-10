import {useEffect, useState} from 'react';
import {
  ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, Clock3, CreditCard,
  Landmark, LockKeyhole, MonitorCheck, ShieldCheck, Smartphone, Store, Wallet,
} from 'lucide-react';
import {isSimulated} from '../lib/config';
import {money} from '../lib/types';
import './PaymentSimulator.css';

type Method = 'ecocash' | 'bank' | 'card' | 'cash';
type Decision = 'approved' | 'declined';
type Stage = 'review' | 'ecocash-details' | 'ecocash-prompt' | 'ecocash-pin' | 'awaiting' | 'processing';

type Props = {
  method: Method;
  totalMinor: number;
  currency: string;
  storeName: string;
  busy: boolean;
  online: boolean;
  onClose: () => void;
  onDecision: (decision: Decision) => Promise<boolean>;
};

const labels: Record<Method, string> = {
  ecocash: 'EcoCash', bank: 'Bank transfer', card: 'Card terminal', cash: 'Cash at cashier',
};

/**
 * A visually realistic but fully fictitious payment experience.
 * No phone prompt, PIN, CVV, card number, SMS or external payment request is sent.
 * The authoritative order is created only through the PostgreSQL checkout API.
 */
export default function PaymentSimulator({method,totalMinor,currency,storeName,busy,online,onClose,onDecision}:Props){
  const [stage,setStage] = useState<Stage>('review');
  const [localError,setLocalError] = useState('');
  const [ecoPhone,setEcoPhone] = useState('077 000 0000');
  const [ecoPin,setEcoPin] = useState('');
  const locked = busy || stage === 'processing';

  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!locked)onClose()};
    document.addEventListener('keydown',onKey);
    return()=>document.removeEventListener('keydown',onKey);
  },[locked,onClose]);

  const start = () => {
    if(!online)return;
    setLocalError('');
    if(method==='cash') { void submit('approved'); return; }
    if(method==='ecocash') { setStage('ecocash-details'); return; }
    setStage('awaiting');
  };

  const ecoPhoneValid = /^[0-9 +()-]{9,16}$/.test(ecoPhone.trim());

  const submit = async(decision:Decision) => {
    if(locked || !online)return;
    setStage('processing');
    setLocalError('');
    if(isSimulated())await new Promise(resolve=>setTimeout(resolve,650));
    try {
      const completed=await onDecision(decision);
      if(!completed){
        setLocalError('The order could not be submitted. Confirm your connection and try again.');
        setStage(method==='cash'?'review':'awaiting');
      }
    } catch(err) {
      setLocalError(err instanceof Error?err.message:'The presentation payment could not be completed.');
      setStage(method==='cash'?'review':'awaiting');
    }
  };

  if(!isSimulated()&&method==='cash')return <div className="payment-sim-overlay" role="presentation">
    <section className="payment-sim-sheet" role="dialog" aria-modal="true" aria-labelledby="cash-checkout-heading">
      <div className="payment-sim-top">
        <span className="payment-sim-tag"><Store size={15}/> CASH AT CASHIER</span>
        <button className="payment-sim-close" type="button" onClick={onClose} disabled={locked} aria-label="Close cash checkout">×</button>
      </div>
      <div className="payment-sim-layout">
        <div className="payment-sim-left">
          <div className="payment-sim-method-icon"><Wallet size={29}/></div>
          <span className="payment-sim-eyebrow">CHECKOUT · CASH</span>
          <h2 id="cash-checkout-heading">Pay at the cashier</h2>
          <p className="payment-sim-subheading">Your order stays pending until the cashier confirms the cash received.</p>
          <div className="payment-sim-amount">
            <span>AMOUNT DUE</span>
            <strong>{money(totalMinor,currency)}</strong>
            <small><Store size={13}/>{storeName}</small>
          </div>
        </div>
        <div className="payment-sim-right">
          <div className="payment-sim-terminal-head"><Wallet size={20}/><span>CASH PAYMENT</span></div>
          <div className="payment-sim-terminal-content">
            <h3>Create your order</h3>
            <p>Take your order number to the cashier. Stock is updated after cash is confirmed.</p>
          </div>
          <button className="btn btn-primary payment-sim-main-action" disabled={!online||locked} onClick={()=>void submit('approved')}>
            Create cash order <ArrowRight size={18}/>
          </button>
        </div>
      </div>
    </section>
  </div>;

  return <div className="payment-sim-overlay" role="presentation">
    <section className="payment-sim-sheet" role="dialog" aria-modal="true" aria-labelledby="demo-payment-heading">
      <div className="payment-sim-top">
        <span className="payment-sim-tag"><ShieldCheck size={15}/> SECURE DEMONSTRATION · NO FUNDS MOVED</span>
        <button className="payment-sim-close" type="button" onClick={onClose} disabled={locked} aria-label="Close presentation payment">×</button>
      </div>
      <div className="payment-sim-layout">
        <div className="payment-sim-left">
          <div className="payment-sim-method-icon">
            {method==='ecocash'?<Smartphone size={29}/>:method==='bank'?<Landmark size={29}/>:method==='card'?<CreditCard size={29}/>:<Wallet size={29}/>}
          </div>
          <span className="payment-sim-eyebrow">CHECKOUT · {labels[method].toUpperCase()}</span>
          <h2 id="demo-payment-heading">
            {stage==='processing'?'Processing payment':
              method==='ecocash'?'Mobile money checkout':
              method==='bank'?'Bank transfer checkout':
              method==='card'?'Card payment terminal':'Pay at the cashier'}
          </h2>
          <p className="payment-sim-subheading">
            {method==='ecocash'?'Review the EcoCash payment flow without sending a real phone request or moving funds.':
             method==='bank'?'Review the bank-transfer approval flow without sharing account details or moving funds.':
             method==='card'?'Review the card payment flow using presentation-only test details.':
             'Your order remains pending until a cashier confirms receipt of cash.'}
          </p>
          <div className="payment-sim-amount">
            <span>AMOUNT DUE</span>
            <strong>{money(totalMinor,currency)}</strong>
            <small><Store size={13}/>{storeName}</small>
          </div>
          {method==='ecocash'&&<div className="payment-sim-demo-field">
            <span>Presentation mobile number</span><strong>077 000 0000</strong>
            <small>Example only. No mobile number is collected or charged.</small>
          </div>}
          {method==='card'&&<div className="payment-sim-demo-card" aria-label="Virtual test card">
            <span>TEST CARD · PRESENTATION ONLY</span>
            <div className="payment-sim-card-chip">▦</div>
            <strong>••••  ••••  ••••  4242</strong>
            <small>PRESENTATION TERMINAL</small>
          </div>}
          {method==='cash'&&<div className="payment-sim-demo-field">
            <span>Cashier confirmation required</span><strong><Clock3 size={18}/> Awaiting cash desk</strong>
            <small>Creating the order will not mark it paid or reduce stock.</small>
          </div>}
        </div>
        <div className="payment-sim-right">
          <div className="payment-sim-terminal-head"><MonitorCheck size={20}/><span>SECURE PAYMENT WORKFLOW</span></div>
          {stage==='processing'?<div className="payment-sim-status" role="status" aria-live="polite">
            <div className="payment-sim-spinner"/>
            <h3>Recording your transaction</h3>
            <p>Recording your presentation payment result. Please don't submit another order.</p>
          </div>: stage==='review'?<>
            <div className="payment-sim-terminal-content">
              <span className="payment-sim-count">STEP 01 / {method==='cash'?'01':'02'}</span>
              <h3>{method==='ecocash'?'Send payment request':method==='bank'?'Start bank transfer':method==='card'?'Present payment card':'Create a cash order'}</h3>
              <p>{method==='ecocash'?'Review and approve or decline the EcoCash payment request in this presentation.':
                  method==='bank'?'Review and approve or decline the bank transfer in this presentation.':
                  method==='card'?'Continue to the card authorisation screen in presentation mode.':
                  'The cashier will locate this order in the Cashier module and confirm the cash transaction.'}</p>
              <div className="payment-sim-indicator"><LockKeyhole size={17}/> Presentation gateway · no funds moved</div>
            </div>
            <button className="btn btn-primary payment-sim-main-action" disabled={!online||locked} onClick={start}>
              {method==='ecocash'?'Send EcoCash request':method==='bank'?'Start bank transfer':method==='card'?'Continue to card payment':'Create pending cash order'}<ArrowRight size={18}/>
            </button>
          </>: stage==='ecocash-details'?<>
            <div className="payment-sim-terminal-content">
              <span className="payment-sim-count">ECOCASH · STEP 01 / 03</span>
              <h3>Enter EcoCash number</h3>
              <p>Use a presentation number only. This screen does not contact EcoCash and does not store the number.</p>
              <label className="payment-sim-input-label" htmlFor="eco-presentation-phone">
                EcoCash mobile number
                <input
                  id="eco-presentation-phone"
                  className="payment-sim-input"
                  value={ecoPhone}
                  maxLength={16}
                  inputMode="tel"
                  onChange={e=>setEcoPhone(e.target.value)}
                />
              </label>
              <div className="payment-sim-indicator"><LockKeyhole size={17}/> Presentation details · no real wallet requested</div>
            </div>
            <button className="btn btn-primary payment-sim-main-action" disabled={!online||locked||!ecoPhoneValid} onClick={()=>setStage('ecocash-prompt')}>
              Send presentation request <ArrowRight size={18}/>
            </button>
            <button className="payment-sim-back" onClick={()=>setStage('review')}><ArrowLeft size={15}/> Back</button>
          </>: stage==='ecocash-prompt'?<>
            <div className="payment-sim-terminal-content">
              <span className="payment-sim-count">ECOCASH · STEP 02 / 03</span>
              <div className="payment-sim-waiting-icon"><Smartphone size={28}/></div>
              <h3>Check your EcoCash prompt</h3>
              <p>On a real phone, the EcoCash prompt would ask you to approve this payment. In this demonstration, continue to the presentation approval screen.</p>
              <div className="payment-sim-request-summary">
                <span>Merchant</span><strong>{storeName}</strong>
                <span>Amount</span><strong>{money(totalMinor,currency)}</strong>
                <span>Number</span><strong>{ecoPhone}</strong>
              </div>
              <div className="payment-sim-indicator"><CircleAlert size={17}/> No prompt has been sent to this number</div>
            </div>
            <button className="btn btn-primary payment-sim-main-action" disabled={!online||locked} onClick={()=>setStage('ecocash-pin')}>
              Continue on presentation phone <ArrowRight size={18}/>
            </button>
            <button className="payment-sim-back" onClick={()=>setStage('ecocash-details')}><ArrowLeft size={15}/> Change number</button>
          </>: stage==='ecocash-pin'?<>
            <div className="payment-sim-terminal-content">
              <span className="payment-sim-count">ECOCASH · STEP 03 / 03</span>
              <h3>Enter demo PIN</h3>
              <p>Enter four fictional digits to demonstrate wallet approval. Do not enter a real EcoCash PIN or any other password.</p>
              <label className="payment-sim-input-label" htmlFor="eco-presentation-pin">
                Presentation PIN
                <input
                  id="eco-presentation-pin"
                  className="payment-sim-pin-input"
                  value={ecoPin}
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="off"
                  placeholder="••••"
                  onChange={e=>setEcoPin(e.target.value.replace(/\D/g,'').slice(0,4))}
                />
              </label>
              <div className="payment-sim-indicator"><ShieldCheck size={17}/> Demo PIN is discarded after confirmation</div>
            </div>
            <button className="btn btn-primary payment-sim-main-action" disabled={!online||locked||ecoPin.length!==4} onClick={()=>{setEcoPin('');void submit('approved');}}>
              <CheckCircle2 size={18}/> Approve presentation payment
            </button>
            <button className="btn btn-outline payment-sim-secondary-action" disabled={!online||locked} onClick={()=>{setEcoPin('');void submit('declined')}}>Cancel payment</button>
            <button className="payment-sim-back" onClick={()=>{setEcoPin('');setStage('ecocash-prompt')}}><ArrowLeft size={15}/> Back to prompt</button>
          </>:<>
            <div className="payment-sim-terminal-content">
              <span className="payment-sim-count">STEP 02 / 02</span>
              <div className="payment-sim-waiting-icon"><Smartphone size={28}/></div>
              <h3>{method==='ecocash'?'Payment request sent':method==='bank'?'Bank transfer awaiting approval':'Authorisation required'}</h3>
              <p>{method==='ecocash'?'Choose the EcoCash customer outcome below. No real phone prompt or transfer is created.':
                  method==='bank'?'Choose the bank customer outcome below. No real bank transfer is created.':
                  'Choose the card authorisation outcome below. No real transaction is created.'}</p>
              <div className="payment-sim-indicator"><CircleAlert size={17}/> Nothing has been charged or transferred</div>
            </div>
            <button className="btn btn-primary payment-sim-main-action" disabled={!online||locked} onClick={()=>void submit('approved')}>
              <CheckCircle2 size={18}/> {method==='ecocash'?'Approve EcoCash payment':method==='bank'?'Approve bank transfer':'Authorise card payment'}
            </button>
            <button className="btn btn-outline payment-sim-secondary-action" disabled={!online||locked} onClick={()=>void submit('declined')}>Decline payment</button>
            <button className="payment-sim-back" disabled={locked} onClick={()=>setStage('review')}><ArrowLeft size={15}/> Back to review</button>
          </>}
          {!online&&<p className="payment-sim-error" role="alert">You are offline. Payment confirmation is unavailable until you reconnect.</p>}
          {localError&&<p className="payment-sim-error" role="alert">{localError}</p>}
          <div className="payment-sim-footer"><ShieldCheck size={17}/> Orders are stored normally; presentation payments move no funds.</div>
        </div>
      </div>
    </section>
  </div>
}
