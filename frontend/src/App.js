import React, { useState, useEffect } from 'react';
import { Upload, MessageSquare, CheckSquare, LayoutDashboard, X } from 'lucide-react';
import Dashboard from './components/Dashboard';
import VideoUpload from './components/VideoUpload';
import ChatInterface from './components/ChatInterface';
import ActionItems from './components/ActionItems';
import './App.css';



function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [meetings, setMeetings] = useState([]);

  useEffect(() => {
    // Load meetings from localStorage
    const savedMeetings = localStorage.getItem('meetings');
    if (savedMeetings) {
      setMeetings(JSON.parse(savedMeetings));
    }
  }, []);

  const saveMeetings = (updatedMeetings) => {
    setMeetings(updatedMeetings);
    localStorage.setItem('meetings', JSON.stringify(updatedMeetings));
  };

  const handleMeetingSelect = (meeting) => {
    setSelectedMeeting(meeting);
    setActiveTab('chat');
  };

  const handleUploadComplete = (meeting) => {
    const newMeeting = {
      ...meeting,
      id: Date.now(),
      actionItems: [],
      chatHistory: []
    };
    saveMeetings([newMeeting, ...meetings]);
    setSelectedMeeting(newMeeting);
    setActiveTab('chat');
  };

  const updateMeeting = (updatedMeeting) => {
    const updatedMeetings = meetings.map(m => 
      m.id === updatedMeeting.id ? updatedMeeting : m
    );
    saveMeetings(updatedMeetings);
    setSelectedMeeting(updatedMeeting);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">Meeting Transcription</h1>
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                  activeTab === 'dashboard'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <LayoutDashboard className="w-5 h-5 mr-2" />
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab('upload')}
                className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                  activeTab === 'upload'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Upload className="w-5 h-5 mr-2" />
                Upload Video
              </button>
              {selectedMeeting && (
                <>
                  <button
                    onClick={() => setActiveTab('chat')}
                    className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                      activeTab === 'chat'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <MessageSquare className="w-5 h-5 mr-2" />
                    Chat
                  </button>
                  <button
                    onClick={() => setActiveTab('action-items')}
                    className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                      activeTab === 'action-items'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <CheckSquare className="w-5 h-5 mr-2" />
                    Action Items
                  </button>
                  <button
                    onClick={() => setSelectedMeeting(null)}
                    className="flex items-center px-4 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                  >
                    <X className="w-5 h-5 mr-2" />
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <Dashboard 
            meetings={meetings} 
            onMeetingSelect={handleMeetingSelect}
          />
        )}
        {activeTab === 'upload' && (
          <VideoUpload onUploadComplete={handleUploadComplete} />
        )}
        {activeTab === 'chat' && selectedMeeting && (
          <ChatInterface meeting={selectedMeeting} onUpdateMeeting={updateMeeting} />
        )}
        {activeTab === 'action-items' && selectedMeeting && (
          <ActionItems meeting={selectedMeeting} onUpdateMeeting={updateMeeting} />
        )}
      </main>
    </div>
  );
}

export default App;
