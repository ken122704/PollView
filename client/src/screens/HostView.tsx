import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ArrowLeft, Users, Copy, Check, Play, Square, RefreshCcw, Pencil, Save, Trash2, Plus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import type { Poll } from '../types/poll';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#ec4899', '#f97316'];

export function HostView() {
  const { pollId } = useParams();
  const navigate = useNavigate();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editQuestion, setEditQuestion] = useState('');
  const [editOptions, setEditOptions] = useState<string[]>([]);

  useEffect(() => {
    if (!pollId) return;
    
    socket.connect();
    socket.emit('join_poll', pollId);
    
    socket.on('poll_state', (data: Poll) => {
      setPoll(data);
      if (data.question === 'Untitled Poll') {
        setEditQuestion(data.question);
        setEditOptions(data.options.map(o => o.label));
        setIsEditing(true);
      }
    });
    
    socket.on('poll_update', (data: Poll) => setPoll(data));
    socket.on('error_message', () => navigate('/'));

    return () => {
      socket.off('poll_state');
      socket.off('poll_update');
      socket.off('error_message');
    };
  }, [pollId, navigate]);

  const copyCode = () => {
    if (!poll) return;
    navigator.clipboard.writeText(poll.shortCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const updateStatus = (status: 'waiting' | 'active' | 'closed') => {
    socket.emit('update_poll_status', { pollId, status });
  };

  const openEditor = () => {
    if (!poll) return;
    setEditQuestion(poll.question);
    setEditOptions(poll.options.map(o => o.label));
    setIsEditing(true);
  };

  const saveEditor = () => {
    const filledOptions = editOptions.map(o => o.trim()).filter(Boolean);
    if (!editQuestion.trim() || filledOptions.length < 2) return;
    
    socket.emit('update_poll', { 
      pollId, 
      question: editQuestion.trim(), 
      options: filledOptions 
    });
    setIsEditing(false);
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...editOptions];
    newOptions[index] = value;
    setEditOptions(newOptions);
  };

  const addOption = () => {
    if (editOptions.length < 8) setEditOptions([...editOptions, '']);
  };

  const removeOption = (index: number) => {
    if (editOptions.length > 2) {
      setEditOptions(editOptions.filter((_, i) => i !== index));
    }
  };

  if (!poll) return <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 text-slate-500">Loading Dashboard...</div>;

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
    <div className="min-h-screen w-full bg-slate-50 flex flex-col items-center p-4 md:p-8">
      <div className="w-full max-w-6xl mx-auto flex flex-col flex-1">
        
        <header className="flex w-full items-center justify-between mb-8">
          <Button variant="ghost" onClick={() => navigate('/')} className="text-slate-500 hover:text-slate-900">
            <ArrowLeft className="w-5 h-5 mr-2" /> 
            Back to Home
          </Button>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm text-slate-600">
            <Users className="w-4 h-4 text-indigo-500" />
            <span className="font-semibold text-sm">{poll.totalVotes} votes</span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full flex-1">
          
          <div className="lg:col-span-2 flex flex-col gap-6 w-full">
            <div className="space-y-2">
              <span className="inline-flex items-center rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-600 tracking-wider uppercase">
                {isEditing ? 'Poll Setup' : 'Live Poll'}
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
                {isEditing ? 'Drafting Mode' : poll.question}
              </h2>
            </div>
            
            <Card className="w-full flex-1 flex flex-col min-h-[450px] border-slate-200 shadow-sm bg-white overflow-hidden">
              <CardContent className="flex-1 p-6 relative flex flex-col">
                
                {isEditing ? (
                  <div className="space-y-6 flex-1 flex flex-col">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Question</label>
                      <Input 
                        value={editQuestion} 
                        onChange={(e) => setEditQuestion(e.target.value)} 
                        className="mt-2 text-lg h-12 bg-slate-50 focus:bg-white"
                        placeholder="What do you want to ask?"
                        autoFocus
                      />
                    </div>
                    
                    <div className="flex-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex justify-between">
                        Options <span className="text-slate-400 font-mono text-xs">{editOptions.length}/8</span>
                      </label>
                      <div className="space-y-3 mt-2">
                        {editOptions.map((opt, i) => (
                          <div key={i} className="flex gap-3 items-center">
                            <span className="text-slate-400 font-mono text-sm w-4">{i + 1}.</span>
                            <Input 
                              value={opt} 
                              onChange={(e) => updateOption(i, e.target.value)} 
                              placeholder={`Option ${i + 1}`}
                              className="h-11 bg-slate-50 focus:bg-white"
                            />
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => removeOption(i)} 
                              disabled={editOptions.length <= 2}
                              className="text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      
                      {editOptions.length < 8 && (
                        <Button variant="outline" onClick={addOption} className="w-full mt-4 border-dashed border-2 text-slate-500 h-11 hover:text-indigo-600 hover:border-indigo-300">
                          <Plus className="w-4 h-4 mr-2" /> Add Option
                        </Button>
                      )}
                    </div>

                    <div className="flex gap-3 pt-6 mt-auto">
                      <Button onClick={saveEditor} className="flex-1 h-12 text-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium">
                        <Save className="w-5 h-5 mr-2" /> Save & Prepare
                      </Button>
                      <Button variant="outline" onClick={() => {
                        if (poll.question === 'Untitled Poll') navigate('/'); 
                        else setIsEditing(false);
                      }} className="h-12 w-28 text-slate-600 font-medium border-slate-200">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {poll.status === 'waiting' && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm rounded-xl">
                        <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4">
                          <Play className="w-10 h-10 ml-1" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Ready to start?</h3>
                        <p className="text-slate-500">Waiting for you to open the poll.</p>
                      </div>
                    )}
                    
                    <div className="h-full w-full flex-1 min-h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 80, left: 10, bottom: 0 }}>
                          <XAxis type="number" hide />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            axisLine={false} 
                            tickLine={false}
                            tick={{ fill: '#475569', fontSize: 14, fontWeight: 500 }}
                            width={100}
                          />
                          <Tooltip 
                            cursor={{fill: '#f1f5f9'}}
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
                          <Bar dataKey="votes" radius={[0, 8, 8, 0]} barSize={40} animationDuration={1000}>
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                            <LabelList dataKey="displayStat" position="right" fill="#64748b" fontSize={14} fontWeight={600} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-6 w-full">
            <Card className="w-full bg-slate-900 text-white border-slate-800 shadow-xl">
              <CardHeader className="pb-4">
                <CardDescription className="text-slate-400 uppercase tracking-widest text-xs font-semibold">Join Code</CardDescription>
                <CardTitle className="text-4xl lg:text-5xl font-mono tracking-widest flex items-center justify-between">
                  {poll.shortCode}
                  <Button size="icon" variant="ghost" className="hover:bg-slate-800 text-slate-300" onClick={copyCode}>
                    {isCopied ? <Check className="w-6 h-6 text-emerald-400" /> : <Copy className="w-6 h-6" />}
                  </Button>
                </CardTitle>
              </CardHeader>
            </Card>

            <Card className="w-full border-slate-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-slate-900">Host Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {poll.status === 'waiting' && (
                  <>
                    <Button 
                      variant="outline" 
                      className="w-full h-12 text-base border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-semibold" 
                      onClick={openEditor}
                      disabled={isEditing}
                    >
                      <Pencil className="w-4 h-4 mr-2" /> Edit Questions
                    </Button>
                    <Button 
                      className="w-full h-12 text-base bg-indigo-600 hover:bg-indigo-700 text-white font-semibold" 
                      onClick={() => updateStatus('active')}
                      disabled={isEditing}
                    >
                      <Play className="w-4 h-4 mr-2" /> Start Poll
                    </Button>
                  </>
                )}
                
                {poll.status === 'active' && (
                  <Button className="w-full h-12 text-base bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-md" onClick={() => updateStatus('closed')}>
                    <Square className="w-4 h-4 mr-2" /> Close Poll
                  </Button>
                )}
                
                {poll.status === 'closed' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Votes</p>
                      <p className="text-4xl font-bold text-slate-900 mt-1">{poll.totalVotes}</p>
                    </div>
                    <Button className="w-full h-12 text-base bg-slate-900 text-white hover:bg-slate-800 font-semibold" onClick={() => updateStatus('waiting')}>
                      <RefreshCcw className="w-4 h-4 mr-2" /> Reset to Waiting
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}