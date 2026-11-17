import {useState} from 'react';
import {Bluetooth, Check, Printer, RefreshCw, Settings} from 'lucide-react';
import {
  getPairedPrinters,
  isAndroidPrinterAvailable,
  openBluetoothSettings,
  printBluetooth,
  selectPrinter,
  type PairedPrinter
} from '../lib/nativePrinter';

export default function PrinterSetup(){
  const [printers,setPrinters]=useState<PairedPrinter[]>([]);
  const [selectedAddress,setSelectedAddress]=useState('');
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const refresh=async()=>{
    setLoading(true);
    setError('');
    try{
      const result=await getPairedPrinters();
      setPrinters(result.printers);
      setSelectedAddress(result.printers.some(printer=>printer.address===result.selectedAddress)?result.selectedAddress||'':'');
      if(!result.printers.length)setError('No paired Bluetooth devices found. Pair the printer in Android Bluetooth settings, then refresh.');
    }catch(e){setError((e as Error).message)}
    finally{setLoading(false)}
  };
  const choose=async(address:string)=>{
    setError('');
    try{
      const printer=await selectPrinter(address);
      setSelectedAddress(printer.address);
    }catch(e){setError((e as Error).message)}
  };
  const test=async()=>{
    setLoading(true);
    setError('');
    try{await printBluetooth({text:'TILLCORE PRINTER TEST\nBluetooth printing is ready.'})}
    catch(e){setError((e as Error).message)}
    finally{setLoading(false)}
  };

  if(!isAndroidPrinterAvailable())return null;
  return <details className="printer-setup" onToggle={e=>{if(e.currentTarget.open)void refresh()}}>
    <summary><Bluetooth size={16}/> Bluetooth printer setup</summary>
    <p>Pair an ESC/POS Bluetooth printer in Android settings, then select it here.</p>
    <div className="printer-setup-actions">
      <button type="button" className="btn btn-outline" onClick={()=>void openBluetoothSettings()}><Settings size={15}/> Bluetooth settings</button>
      <button type="button" className="btn btn-outline" disabled={loading} onClick={()=>void refresh()}><RefreshCw size={15}/> Refresh</button>
    </div>
    {loading&&<small>Working…</small>}
    {printers.map(printer=><button type="button" className="printer-choice" key={printer.address} onClick={()=>void choose(printer.address)}>
      <span><Printer size={16}/>{printer.name}<small>{printer.address}</small></span>
      {printer.address===selectedAddress&&<Check size={18}/>}
    </button>)}
    {selectedAddress&&<button type="button" className="btn btn-primary" disabled={loading} onClick={()=>void test()}><Printer size={15}/> Print test</button>}
    {error&&<p className="error" role="alert">{error}</p>}
    <small>Direct printing uses Bluetooth Classic (SPP) with ESC/POS commands. Other printer protocols need a matching adapter.</small>
  </details>;
}
