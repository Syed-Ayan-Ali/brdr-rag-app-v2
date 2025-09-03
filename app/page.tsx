import ChatPanel from '@/components/ChatPanel';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="">
        {/* <AuditWarning variant="warning" /> */}
        <ChatPanel />
      </div>
    </div>
  );
} 
