import {useEffect, useState} from 'react';
import {
  ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, Clock3, CreditCard,
  Landmark, LockKeyhole, MonitorCheck, ShieldCheck, Smartphone, Store, Wallet,
} from 'lucide-react';
import {money} from '../lib/types';
import './PaymentSimulator.css';

type Method = 'ecocash' | 'bank' | 'card' | 'cash';
type Decision = 'approved' | 'declined';
type Stage = 'review' | 'awaiting' | 'processing';

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
    setStage('awaiting');
  };

  const submit = async(decision:Decision) => {
    if(locked || !online)return;
    setStage('processing');
    setLocalError('');
    // Present a brief terminal-style processing state without simulating a real provider response.
    await new Promise(resolve=>setTimeout(resolve,650));
    try {
      const completed=await onDecision(decision);
      if(!completed){
        setLocalError('The order could not be submitted. Confirm your connection and try again.');
        setStage(method==='cash'?'review':'awaiting');
      }
    } catch(err) {
      setLocalError(err instanceof Error?err.message:'The payment demonstration could not be completed.');
      setStage(method==='cash'?'review':'awaiting');
    }
  };

  return <div className="payment-sim-overlay" role="presentation">
    <section className="payment-sim-sheet" role="dialog" aria-modal="true" aria-labelledby="demo-payment-heading">
      <div className="payment-sim-top">
        <span className="payment-sim-tag"><ShieldCheck size={15}/> UNIVERSITY DEMO · NO REAL MONEY</span>
        <button className="payment-sim-close" type="button" onClick={onClose} disabled={locked} aria-label="Close simulated payment">×</button>
      </div>
      <div className="payment-sim-layout">
        <div className="payment-sim-left">
          <div className="payment-sim-method-icon">
            {method==='ecocash'?<Smartphone size={29}/>:method==='bank'?<Landmark size={29}/>:method==='card'?<CreditCard size={29}/>:<Wallet size={29}/>}
          </div>
          <span className="payment-sim-eyebrow">CHECKOUT · {labels[method].toUpperCase()}</span>
          <h2 id="demo-payment-heading">
            {stage==='processing'?'Processing demo transaction':
              method==='ecocash'?'Mobile money checkout':
              method==='bank'?'Bank transfer checkout':
              method==='card'?'Card payment terminal':'Pay at the cashier'}
          </h2>
          <p className="payment-sim-subheading">
            {method==='ecocash'?'Experience a realistic EcoCash-style payment request without sending an actual phone prompt.':
             method==='bank'?'Complete a simulated bank transfer confirmation without sharing account details.':
             method==='card'?'A virtual card terminal for the university demonstration. Never enter real card details.':
             'Your order will remain pending until a cashier confirms the simulated cash payment.'}
          </p>
          <div className="payment-sim-amount">
            <span>AMOUNT DUE</span>
            <strong>{money(totalMinor,currency)}</strong>
            <small><Store size={13}/>{storeName}</small>
          </div>
          {method==='ecocash'&&<div className="payment-sim-demo-field">
            <span>Demo mobile number</span><strong>077 000 0000</strong>
            <small>Example only. No mobile number is collected or charged.</small>
          </div>}
          {method==='card'&&<div className="payment-sim-demo-card" aria-label="Virtual test card">
            <span>DEMO CARD · NOT VALID FOR PURCHASES</span>
            <div className="payment-sim-card-chip">▦</div>
            <strong>••••  ••••  ••••  4242</strong>
            <small>SIMULATED TERMINAL</small>
          </div>}
          {method==='cash'&&<div className="payment-sim-demo-field">
            <span>Cashier confirmation required</span><strong><Clock3 size={18}/> Awaiting cash desk</strong>
            <small>Creating the order will not mark it paid or reduce stock.</small>
          </div>}
        </div>
        <div className="payment-sim-right">
          <div className="payment-sim-terminal-head"><MonitorCheck size={20}/><span>SECURE CHECKOUT DEMONSTRATION</span></div>
          {stage==='processing'?<div className="payment-sim-status" role="status" aria-live="polite">
            <div className="payment-sim-spinner"/>
            <h3>Recording your transaction</h3>
            <p>Submitting the simulated result to SSTWAS. Please don't submit another order.</p>
          </div>: stage==='review'?<>
            <div className="payment-sim-terminal-content">
              <span className="payment-sim-count">STEP 01 / {method==='cash'?'01':'02'}</span>
              <h3>{method==='ecocash'?'Send a demo payment request':method==='bank'?'Start a simulated bank transfer':method==='card'?'Present a virtual test card':'Create a cash order'}</h3>
              <p>{method==='ecocash'?'A pretend EcoCash authorisation screen will appear, where you can approve or reject the test transaction.':
                  method==='bank'?'A simulated bank approval screen will appear. No account details, PIN or real transfer is required.':
                  method==='card'?'Tap below to imitate presenting a test card to the terminal.':
                  'The cashier will locate this order in the Cashier module and confirm the cash transaction.'}</p>
              <div className="payment-sim-indicator"><LockKeyhole size={17}/> No real gateway connected</div>
            </div>
            <button className="btn btn-primary payment-sim-main-action" disabled={!online||locked} onClick={start}>
              {method==='ecocash'?'Send simulated EcoCash request':method==='bank'?'Start simulated bank transfer':method==='card'?'Present demo card':'Create pending cash order'}<ArrowRight size={18}/>
            </button>
          </>:<>
            <div className="payment-sim-terminal-content">
              <span className="payment-sim-count">STEP 02 / 02</span>
              <div className="payment-sim-waiting-icon"><Smartphone size={28}/></div>
              <h3>{method==='ecocash'?'Payment request sent (demo)':method==='bank'?'Bank transfer awaiting approval (demo)':'Authorisation required (demo)'}</h3>
              <p>{method==='ecocash'?'A real EcoCash customer would approve this request on their phone. Here, choose the simulated outcome below.':
                  method==='bank'?'A real bank payment would require customer approval. Choose the simulated bank outcome below.':
                  'A real card terminal would contact the payment provider. Choose the simulated authorisation outcome below.'}</p>
              <div className="payment-sim-indicator"><CircleAlert size={17}/> Nothing has been charged or transferred</div>
            </div>
            <button className="btn btn-primary payment-sim-main-action" disabled={!online||locked} onClick={()=>void submit('approved')}>
              <CheckCircle2 size={18}/> {method==='ecocash'?'Approve demo prompt':method==='bank'?'Approve demo transfer':'Authorise demo card'}
            </button>
            <button className="btn btn-outline payment-sim-secondary-action" disabled={!online||locked} onClick={()=>void submit('declined')}>Decline simulated payment</button>
            <button className="payment-sim-back" disabled={locked} onClick={()=>setStage('review')}><ArrowLeft size={15}/> Back to review</button>
          </>}
          {!online&&<p className="payment-sim-error" role="alert">You are offline. Payment confirmation is unavailable until you reconnect.</p>}
          {localError&&<p className="payment-sim-error" role="alert">{localError}</p>}
          <div className="payment-sim-footer"><ShieldCheck size={17}/> Stored orders are real; the payment interaction is a simulation.</div>
        </div>
      </div>
    </section>
  </div>
}
