import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Users, Play, ArrowRight } from 'lucide-react';
import type { Poll } from '../types/poll';
import Logo from '../assets/Logo.png';

export function Home() {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    socket.connect();
    return () => {
      socket.off('connect');
    };
  }, []);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (joinCode.trim().length === 6) {
      navigate(`/join/${joinCode.trim().toUpperCase()}`);
    }
  }

  function handleCreateDraftPoll() {
    socket.once('poll_created', (poll: Poll) => {
      navigate(`/host/${poll.id}`);
    });
    
    socket.emit('create_poll', {
      question: 'Untitled Poll',
      options: ['Option 1', 'Option 2']
    });
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-12 items-center mx-auto">
        
        {/* Left Side: Branding / Intro */}
        <div className="space-y-6 flex flex-col justify-center">
          <img  src={Logo}  alt="logo"  className="block w-40 h-40 mb-0 -ml-5"  />
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 leading-tight">
            Real-time polling for <span className="text-indigo-600">everyone.</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-md">
            Engage your audience, make decisions faster, and easily gather insights with live interactive polls.
          </p>
          
          <div className="flex items-center gap-4 pt-2 text-sm font-medium text-slate-500">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              <span>10k+ Users</span>
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
            <div className="flex items-center gap-2">
              <Play className="w-5 h-5 text-emerald-500" />
              <span>Instant Setup</span>
            </div>
          </div>
        </div>

        {/* Right Side: Actions */}
        <div className="flex flex-col gap-6 w-full">
          <Card className="w-full border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900">Join a Poll</CardTitle>
              <CardDescription className="text-slate-500">Enter the code provided by the host to participate.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleJoin} className="flex gap-3">
                <Input 
                  placeholder="e.g. 123456" 
                  className="font-mono text-lg tracking-wider text-center uppercase h-12 bg-slate-50 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  maxLength={6}
                />
                <Button type="submit" className="h-12 px-6 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-semibold" disabled={joinCode.length !== 6}>
                  Join
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="w-full bg-slate-900 border-slate-800 shadow-xl">
            <CardHeader>
              <CardTitle className="text-white">Host a Poll</CardTitle>
              <CardDescription className="text-slate-400">Create a new session and invite participants.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleCreateDraftPoll} 
                className="w-full bg-white text-slate-900 hover:bg-slate-100 text-lg h-14 font-semibold transition-all"
              >
                Create New Poll
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}