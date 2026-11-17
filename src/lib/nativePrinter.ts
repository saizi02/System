import {Capacitor, registerPlugin} from '@capacitor/core';

export type PairedPrinter={name:string;address:string};
type PrinterList={printers:PairedPrinter[];selectedAddress?:string|null};

interface BluetoothPrinterPlugin {
  getPairedPrinters():Promise<PrinterList>;
  selectPrinter(options:{address:string}):Promise<PairedPrinter>;
  openBluetoothSettings():Promise<void>;
  print(options:{text:string;qrData?:string}):Promise<{printed:boolean}>;
}

const bluetoothPrinter=registerPlugin<BluetoothPrinterPlugin>('BluetoothPrinter');

export const isAndroidPrinterAvailable=()=>Capacitor.isNativePlatform()&&Capacitor.getPlatform()==='android';

export const getPairedPrinters=()=>bluetoothPrinter.getPairedPrinters();
export const selectPrinter=(address:string)=>bluetoothPrinter.selectPrinter({address});
export const openBluetoothSettings=()=>bluetoothPrinter.openBluetoothSettings();
export const printBluetooth=({text,qrData}:{text:string;qrData?:string})=>bluetoothPrinter.print({text,qrData});
