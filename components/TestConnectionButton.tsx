'use client';
// when the user presses this button, it will test the connection to the database using the function in SupabaseService and console log the result
import { SupabaseService } from '@/lib/database/SupabaseService';

const supabaseService = SupabaseService.getInstance();

export default function TestConnectionButton() {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isConnected = supabaseService.testConnection();
    console.log("Connection test result:", isConnected);
  };


  return (
    <div className="relative">
      {/* Floating Container */}
      <button onClick={handleSubmit} className="text-slate-500 hover:text-slate-600 transition-colors">
        Test Connection
      </button>  
    </div>
  );
} 