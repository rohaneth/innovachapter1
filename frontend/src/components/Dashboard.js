import React, { useState } from 'react';
import { Calendar, Clock, User, TrendingUp, CheckCircle, Circle, Lock, Mail, ArrowRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

let hasLoggedInThisSession = false;

const Dashboard = ({ meetings, onMeetingSelect, onUploadClick }) => {
  const [showAuth, setShowAuth] = useState(!hasLoggedInThisSession);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (!fullName || !email || !password) return;
    hasLoggedInThisSession = true;
    setShowAuth(false);
  };
  // Flatten all action items from all meetings (each meeting has actionItems array)
  const allActionItems = meetings.flatMap(meeting => meeting.actionItems || []);

  const actionItemStats = {
    pending: allActionItems.filter(item => item.status === 'pending').length,
    completed: allActionItems.filter(item => item.status === 'completed').length,
    in_progress: allActionItems.filter(item => item.status === 'in_progress').length,
  };

  const pieData = [
    { name: 'Pending', value: actionItemStats.pending || 0, color: '#f59e0b' },
    { name: 'Completed', value: actionItemStats.completed || 0, color: '#10b981' },
    { name: 'In Progress', value: actionItemStats.in_progress || 0, color: '#3b82f6' },
  ];

  const parseDeadline = (deadlineStr) => {
    if (!deadlineStr) return new Date(8640000000000000); // Far future
    const match = deadlineStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      return new Date(match[3], match[2] - 1, match[1]);
    }
    const parsed = Date.parse(deadlineStr);
    if (!isNaN(parsed)) return new Date(parsed);
    const lower = deadlineStr.toLowerCase();
    const today = new Date();
    if (lower.includes('today')) return today;
    if (lower.includes('tomorrow')) {
      const tomorrow = new Date();
      tomorrow.setDate(today.getDate() + 1);
      return tomorrow;
    }
    return new Date(8640000000000000); // Far future
  };

  // Upcoming deadlines (pending items with a deadline)
  const upcomingDeadlines = allActionItems
    .filter(item => item.status === 'pending' && item.deadline && item.deadline !== '—')
    .sort((a, b) => parseDeadline(a.deadline) - parseDeadline(b.deadline))
    .slice(0, 10);

  if (showAuth) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 overflow-y-auto p-4 backdrop-blur-md">
        {/* Floating background blobs */}
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-blue-600/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-600/25 rounded-full blur-3xl animate-pulse delay-700"></div>

        <div className="relative w-full max-w-md bg-white/10 border border-white/20 rounded-2xl shadow-2xl p-8 backdrop-blur-xl animate-fadeIn text-white">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 mb-4 shadow-lg shadow-blue-500/20">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
              Access Dashboard
            </h2>
            <p className="text-sm text-slate-300 mt-2">
              Create an account or sign in to track meeting insights
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Full Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Alex Johnson"
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-slate-500 text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@company.com"
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-slate-500 text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-slate-500 text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-6 py-3 px-4 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 transition-all duration-200 cursor-pointer"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <p className="text-[11px] text-slate-400 text-center mt-6">
            Secured end-to-end. By continuing, you agree to our terms.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Action Items</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {allActionItems.length}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <CheckCircle className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Tasks</p>
              <p className="text-3xl font-bold text-orange-600 mt-2">
                {actionItemStats.pending}
              </p>
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed Tasks</p>
              <p className="text-3xl font-bold text-green-600 mt-2">
                {actionItemStats.completed}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts and Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Task Status Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Upcoming Deadlines */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Deadlines</h2>
          {upcomingDeadlines.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No upcoming deadlines</p>
          ) : (
            <div className="space-y-3">
              {upcomingDeadlines.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.task}</p>
                    <div className="flex items-center mt-1 text-sm text-gray-600">
                      <User className="w-4 h-4 mr-1" />
                      {item.owner}
                    </div>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="w-4 h-4 mr-1" />
                    {item.deadline}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Meetings */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Meetings</h2>
        {meetings.length === 0 ? (
          <div className="text-center py-10 flex flex-col items-center">
            <p className="text-gray-500 mb-4 font-semibold text-sm">No meetings yet. Upload a video to get started!</p>
            {onUploadClick && (
              <button
                onClick={onUploadClick}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-all cursor-pointer"
              >
                Upload Meeting Video
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {meetings.slice(0, 5).map((meeting) => (
              <div
                key={meeting.id}
                onClick={() => onMeetingSelect(meeting)}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{meeting.title}</p>
                  <div className="flex items-center mt-1 text-sm text-gray-600">
                    <Calendar className="w-4 h-4 mr-1" />
                    {new Date(meeting.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-blue-600">
                  <Circle className="w-5 h-5" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;