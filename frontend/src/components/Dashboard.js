import React from 'react';
import { Calendar, Clock, User, TrendingUp, CheckCircle, Circle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const Dashboard = ({ meetings, onMeetingSelect }) => {
  // Calculate stats from meetings data
  const allActionItems = meetings.flatMap(meeting => meeting.actionItems || []);
  
  const actionItemStats = {
    pending: allActionItems.filter(item => item.status === 'pending').length,
    completed: allActionItems.filter(item => item.status === 'completed').length,
    in_progress: allActionItems.filter(item => item.status === 'in_progress').length
  };

  const pieData = [
    { name: 'Pending', value: actionItemStats.pending || 0, color: '#f59e0b' },
    { name: 'Completed', value: actionItemStats.completed || 0, color: '#10b981' },
    { name: 'In Progress', value: actionItemStats.in_progress || 0, color: '#3b82f6' }
  ];

  const upcomingDeadlines = allActionItems
    .filter(item => item.status === 'pending' && item.deadline)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Action Items</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {actionItemStats.pending + 
                 actionItemStats.completed + 
                 actionItemStats.in_progress}
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
              {upcomingDeadlines.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.description}</p>
                    <div className="flex items-center mt-1 text-sm text-gray-600">
                      <User className="w-4 h-4 mr-1" />
                      {item.owner}
                    </div>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="w-4 h-4 mr-1" />
                    {new Date(item.deadline).toLocaleDateString()}
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
          <p className="text-gray-500 text-center py-8">No meetings yet. Upload a video to get started!</p>
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
