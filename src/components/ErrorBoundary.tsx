import React from 'react';
type State={failed:boolean;message:string};
export default class ErrorBoundary extends React.Component<{children:React.ReactNode},State>{
 state:State={failed:false,message:''};
 static getDerivedStateFromError(error:Error):State{return{failed:true,message:error.message}}
 componentDidCatch(error:Error,info:React.ErrorInfo){console.error('SSTWAS page error:',error,info.componentStack)}
 render(){if(this.state.failed)return <main className="setup-screen"><h1>Unable to display this page</h1><p>Something went wrong in the interface. Your PostgreSQL data is unaffected by this display error.</p><pre style={{whiteSpace:'pre-wrap'}}>{this.state.message}</pre><button className="btn btn-primary" onClick={()=>window.location.assign('/')}>Return to checkout</button></main>;return this.props.children}
}
