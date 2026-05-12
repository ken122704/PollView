import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import { Card, CardContent, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ArrowLeft, Loader2, Play } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import type { Poll } from '../types/poll';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#ec4899', '#f97316'];

export function ParticipantView() {
  const { shortCode } = useParams();
  const navigate = useNavigate();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [error, setError] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    socket.connect();
    socket.emit('join_by_code', shortCode);
    
    socket.on('poll_state', (data: Poll) => setPoll(data));
    socket.on('poll_update', (data: Poll) => {
      setPoll(data);
      if (data.status === 'waiting') {
        setSelectedOption(null);
      }
    });
    socket.on('error_message', (msg: string) => setError(msg));

    return () => {
      socket.off('poll_state');
      socket.off('poll_update');
      socket.off('error_message');
    };
  }, [shortCode]);

  const handleVote = (id: string) => {
    if (selectedOption || !poll || poll.status !== 'active') return;
    
    setSelectedOption(id);
    setIsSubmitting(true);
    socket.emit('cast_vote', { pollId: poll.id, optionId: id });
    
    setTimeout(() => {
      setIsSubmitting(false);
    }, 600);
  };

  const handleLeave = () => {
    navigate('/');
  };

  if (error) return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-8">
      <div className="bg-rose-50 text-rose-600 px-6 py-4 rounded-xl border border-rose-200 font-medium shadow-sm">
        {error}
      </div>
    </div>
  );
  
  if (!poll) return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-8 text-slate-500 font-medium">
      <Loader2 className="w-6 h-6 animate-spin mr-3" /> Connecting to room...
    </div>
  );

  const showResults = poll.status === 'closed' || (selectedOption && !isSubmitting);

  // We calculate the percentage and create a custom string for the LabelList
  const chartData = poll.options.map((opt, index) => {
    const percentage = poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0;
    return {
      name: opt.label,
      votes: opt.votes,
      displayStat: `${opt.votes} (${percentage}%)`,
      color: COLORS[index % COLORS.length]
    };
  });

  return (
    <div className="min-h-screen w-full bg-slate-50 flex flex-col p-4 md:p-8">
      <div className="w-full max-w-2xl mx-auto flex flex-col flex-1 justify-center">
        
        <header className="flex w-full items-center justify-between mb-8">
          <Button variant="ghost" onClick={handleLeave} className="text-slate-500 hover:text-slate-900 hover:bg-slate-100">
            <ArrowLeft className="w-5 h-5 mr-2" /> 
            Leave
          </Button>
          <div className="bg-white px-3 py-1.5 rounded-full flex gap-2 items-center border border-slate-200 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-mono tracking-widest text-slate-500 uppercase leading-none mt-0.5">Connected</span>
          </div>
        </header>
        
        <AnimatePresence mode="wait">
          {poll.status === 'waiting' ? (
             <motion.div 
               key="waiting"
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="w-full max-w-md mx-auto"
             >
               <Card className="border-slate-200 bg-white text-center py-12 shadow-md">
                 <CardContent className="flex flex-col items-center justify-center space-y-4">
                   <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mb-2">
                     <Play className="w-8 h-8 ml-1 opacity-50" />
                   </div>
                   <CardTitle className="text-2xl text-slate-900">Hang tight!</CardTitle>
                   <p className="text-slate-500 max-w-[250px] mx-auto">
                     The host hasn't opened voting yet.
                   </p>
                 </CardContent>
               </Card>
             </motion.div>
          ) : showResults ? (
            <motion.div 
              key="results"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="w-full flex flex-col gap-6"
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-2">
                <div className="space-y-2">
                  <span className={cn(
                    "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold tracking-wider uppercase",
                    poll.status === 'closed' ? "bg-slate-200 text-slate-700" : "bg-emerald-100 text-emerald-700"
                  )}>
                    {poll.status === 'closed' ? 'Final Results' : 'Vote Recorded'}
                  </span>
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-900 leading-snug">
                    {poll.question}
                  </h1>
                </div>
                <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm text-center min-w-[120px]">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Votes</p>
                  <p className="text-2xl font-bold text-slate-900 mt-0.5">{poll.totalVotes}</p>
                </div>
              </div>

              <Card className="w-full border-slate-200 shadow-sm bg-white overflow-hidden mt-2">
                <CardContent className="p-4 md:p-6">
                  <div className="w-full h-[350px] md:h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      {/* Notice right: 80 margin to give the labels room to breathe */}
                      <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 80, left: 0, bottom: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          axisLine={false} 
                          tickLine={false}
                          tick={{ fill: '#475569', fontSize: 13, fontWeight: 500 }}
                          width={100}
                        />
                        <Tooltip 
                          cursor={{fill: '#f8fafc'}}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-white text-slate-900 rounded-lg px-4 py-2.5 text-sm shadow-xl border border-slate-200 font-medium">
                                  <span className="text-slate-500">{payload[0].payload.name}:</span> {payload[0].value} votes
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="votes" radius={[0, 8, 8, 0]} barSize={36} animationDuration={1000}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                          {/* This is the magic line that renders the text outside the bar! */}
                          <LabelList dataKey="displayStat" position="right" fill="#64748b" fontSize={14} fontWeight={600} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div 
              key="voting"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md mx-auto flex flex-col gap-6"
            >
              <div className="space-y-2 px-2">
                <span className="inline-flex items-center rounded-md bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700 tracking-wider uppercase">
                  Live Poll
                </span>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 leading-snug">
                  {poll.question}
                </h1>
              </div>

              <div className="flex flex-col gap-3 w-full">
                {poll.options.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => handleVote(opt.id)}
                    disabled={!!selectedOption || poll.status !== 'active'}
                    className={cn(
                      "w-full text-left px-5 py-4 rounded-xl border-2 transition-all duration-200 flex items-center justify-between font-semibold text-lg shadow-sm bg-white",
                      selectedOption === opt.id ? 'border-indigo-500 bg-indigo-50 text-indigo-900' : 'border-slate-200 text-slate-700 hover:border-indigo-300 hover:shadow-md cursor-pointer'
                    )}
                  >
                    <span>{opt.label}</span>
                    {isSubmitting && selectedOption === opt.id && (
                      <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}