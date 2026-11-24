import React, { useState } from 'react';
import { CheckCircle2, Mail, MessageCircle, Send } from 'lucide-react';

export const ContactPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError('অনুগ্রহ করে নাম, ইমেইল এবং বার্তা পূরণ করুন। (Please fill in all fields.)');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('সঠিক ইমেইল ঠিকানা দিন। (Please enter a valid email address.)');
      return;
    }
    setSubmitted(true);
    setName('');
    setEmail('');
    setMessage('');
  };

  return (
    <div className="max-w-[820px] mx-auto space-y-5">
      <section
        className="rounded-[22px] p-6 sm:p-8 text-white"
        style={{ background: 'linear-gradient(120deg, #0f2a5c, #1e4fa3 70%, #f57c00)' }}
      >
        <h1 className="text-2xl sm:text-3xl font-bold m-0 mb-1">
          📞 যোগাযোগ / Contact Kaajer Tools
        </h1>
        <p className="text-sm sm:text-base text-white/90 m-0">
          যেকোনো টুলস সংক্রান্ত সহায়তা, পরামর্শ বা মতামতের জন্য আমাদের সাথে যোগাযোগ করুন।
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        <div className="md:col-span-5 bg-[var(--card)] border border-[var(--bd)] rounded-[18px] p-5 space-y-4">
          <h2 className="text-lg font-bold m-0">Helpdesk Info</h2>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#f57c00]/15 text-[#f57c00] grid place-items-center shrink-0">
              <MessageCircle className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-[var(--mut)]">WhatsApp Support</div>
              <div className="font-bold text-sm tabular-nums">90000 00000</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#0f2a5c]/15 text-[#0f2a5c] dark:text-[#ffb347] grid place-items-center shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-[var(--mut)]">Helpdesk Email</div>
              <div className="font-bold text-sm">hello@kaajertools.example</div>
            </div>
          </div>

          <div className="rounded-[12px] bg-[var(--bg)] border border-[var(--bd)] p-3 text-xs text-[var(--mut)] leading-relaxed">
            সমস্ত PDF, Image এবং ডকুমেন্ট টুল সম্পূর্ণ আপনার ব্রাউজারে চলে। আপনার কোনো ফাইল আমাদের কাছে আসে না।
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="md:col-span-7 bg-[var(--card)] border border-[var(--bd)] rounded-[18px] p-5 space-y-3.5"
        >
          <h2 className="text-lg font-bold m-0">Send a Message / বার্তা পাঠান</h2>

          {submitted && (
            <div className="flex items-center gap-2 rounded-[10px] p-3 text-sm font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              ধন্যবাদ! আপনার বার্তাটি গ্রহণ করা হয়েছে।
            </div>
          )}

          {error && (
            <div className="rounded-[10px] p-3 text-sm font-semibold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold mb-1">Your Name / আপনার নাম</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="আপনার নাম লিখুন"
              className="w-full px-3 py-2.5 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">Email Address / ইমেইল</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">Message / আপনার বার্তা</label>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="আপনার প্রশ্ন বা পরামর্শ লিখুন..."
              className="w-full px-3 py-2.5 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
            />
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-bold bg-[#f57c00] hover:bg-[#e06d00] text-white cursor-pointer"
          >
            <Send className="w-4 h-4" />
            Send Message
          </button>
        </form>
      </div>
    </div>
  );
};
