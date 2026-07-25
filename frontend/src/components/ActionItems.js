import React, { useState, useEffect } from 'react';
import { Clock, Bell, X, Check, AlertCircle, RefreshCw, CheckSquare } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || (window.location.port === '3000' ? 'http://localhost:8000' : window.location.origin);

const parseJsonResponse = (text) => {
  const trimmed = text.trim();
  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(match ? match[1].trim() : trimmed);
};

const cleanWords = (str) => {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
};

const findBestAssignment = (actionTask, assignments) => {
  const actionWords = cleanWords(actionTask);
  if (actionWords.length === 0) return {};

  let bestMatch = {};
  let highestScore = 0;

  for (const assignment of assignments) {
    const assignmentWords = cleanWords(assignment.task);
    if (assignmentWords.length === 0) continue;

    // Calculate overlap of words
    const assignmentWordSet = new Set(assignmentWords);
    const intersection = actionWords.filter(w => assignmentWordSet.has(w));
    
    // Score based on word overlap ratio
    const score = intersection.length / Math.max(actionWords.length, assignmentWords.length);
    
    if (score > highestScore) {
      highestScore = score;
      bestMatch = assignment;
    }
  }

  // Use the match if it has at least 40% similarity, otherwise return empty
  return highestScore >= 0.4 ? bestMatch : {};
};

// Play a nice double-tone synthesizer beep for notifications using the Web Audio API
const playAlarmBeep = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    const playBeep = (time, duration, frequency) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, time);
      
      gain.gain.setValueAtTime(0.3, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
      
      osc.start(time);
      osc.stop(time + duration);
    };

    const now = audioCtx.currentTime;
    // Play a dual-tone chime
    playBeep(now, 0.15, 880);      // A5
    playBeep(now + 0.2, 0.15, 660);  // E5
    playBeep(now + 0.4, 0.35, 1200); // D6
  } catch (err) {
    console.error("Audio Context error:", err);
  }
};

// Request Notification permissions if needed
const requestNotificationPermission = () => {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
};

// Show a desktop notification (fallback to standard alert if permission not granted)
const showNotification = (taskName) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Task Timer Expired', {
      body: `"${taskName}" timer is up!`,
    });
  } else {
    alert(`⏰ Timer expired for task: "${taskName}"`);
  }
};

const ActionItems = ({ meeting, onUpdateMeeting }) => {
  const transcript = meeting?.transcript || '';
  const [items, setItems] = useState([]);       // unified array: { task, priority, status, owner, deadline, timerStatus, timerEnd, timerDuration }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // States for the inline timer custom configuration
  const [openMenuIndex, setOpenMenuIndex] = useState(null);
  const [customMode, setCustomMode] = useState(false);
  const [customDuration, setCustomDuration] = useState({ value: '5', unit: 'min' });

  // Local state representing the current time (ticks every second when timers are active)
  const [now, setNow] = useState(Date.now());

  // Request notification permissions on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Fetch and merge action items and assignments
  const fetchData = async () => {
    if (!transcript || transcript.trim() === '') {
      setError('No transcript available to analyze.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch action items
      const actionRes = await fetch(`${API_URL}/api/action-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });
      if (!actionRes.ok) throw new Error('Failed to fetch action items');
      const actionData = await actionRes.json();
      const parsedActions = parseJsonResponse(actionData.action_items); // array of { task, priority, status }

      // Fetch owner/deadline assignments
      const ownerRes = await fetch(`${API_URL}/api/owner-deadlines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });
      if (!ownerRes.ok) throw new Error('Failed to fetch owner/deadline assignments');
      const ownerData = await ownerRes.json();
      const parsedAssignments = parseJsonResponse(ownerData.assignments); // array of { task, owner, deadline }

      // Merge: combine action items with assignments by fuzzy task matching
      const merged = parsedActions.map(action => {
        const assignment = findBestAssignment(action.task, parsedAssignments);
        return {
          task: action.task || '—',
          priority: action.priority || '—',
          status: action.status || 'pending', // default if missing
          owner: assignment.owner || '—',
          deadline: assignment.deadline || '—',
          timerStatus: 'none',
          timerEnd: null,
          timerDuration: null
        };
      });

      setItems(merged);
      // Notify parent if update callback exists
      if (onUpdateMeeting) {
        onUpdateMeeting({
          ...meeting,
          actionItems: merged
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load existing items or auto-fetch if empty on mount/change
  useEffect(() => {
    if (meeting?.actionItems && meeting.actionItems.length > 0) {
      // Check if any active timers already expired while offline/away
      const currentNow = Date.now();
      let updated = false;
      const nextItems = meeting.actionItems.map(item => {
        if (item.timerStatus === 'active' && item.timerEnd && currentNow >= item.timerEnd) {
          playAlarmBeep();
          showNotification(item.task);
          updated = true;
          return {
            ...item,
            timerStatus: 'expired',
            timerEnd: null
          };
        }
        return item;
      });

      if (updated) {
        setItems(nextItems);
        if (onUpdateMeeting) {
          onUpdateMeeting({
            ...meeting,
            actionItems: nextItems
          });
        }
      } else {
        setItems(meeting.actionItems);
      }
    } else if (transcript) {
      fetchData();
    } else {
      setItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting?.id]);

  // Global ticking interval effect to run countdown updates
  const hasActiveTimers = items.some(item => item.timerStatus === 'active' && item.timerEnd);

  useEffect(() => {
    if (!hasActiveTimers) return;

    const interval = setInterval(() => {
      const currentNow = Date.now();
      setNow(currentNow);

      let updated = false;
      const nextItems = items.map(item => {
        if (item.timerStatus === 'active' && item.timerEnd && currentNow >= item.timerEnd) {
          playAlarmBeep();
          showNotification(item.task);
          updated = true;
          return {
            ...item,
            timerStatus: 'expired',
            timerEnd: null
          };
        }
        return item;
      });

      if (updated) {
        setItems(nextItems);
        if (onUpdateMeeting) {
          onUpdateMeeting({
            ...meeting,
            actionItems: nextItems
          });
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [hasActiveTimers, items, meeting, onUpdateMeeting]);

  // Toggle status between 'pending' and 'completed'
  const toggleStatus = (index) => {
    const updated = [...items];
    const current = updated[index].status;
    updated[index].status = current === 'pending' ? 'completed' : 'pending';
    setItems(updated);
    if (onUpdateMeeting) {
      onUpdateMeeting({
        ...meeting,
        actionItems: updated
      });
    }
  };

  // Start timer for a task
  const startTimer = (index, seconds) => {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      timerStatus: 'active',
      timerEnd: Date.now() + seconds * 1000,
      timerDuration: seconds
    };
    setItems(updated);
    if (onUpdateMeeting) {
      onUpdateMeeting({
        ...meeting,
        actionItems: updated
      });
    }
  };

  // Cancel an active timer
  const cancelTimer = (index) => {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      timerStatus: 'none',
      timerEnd: null,
      timerDuration: null
    };
    setItems(updated);
    if (onUpdateMeeting) {
      onUpdateMeeting({
        ...meeting,
        actionItems: updated
      });
    }
  };

  // Dismiss completed timer alert
  const dismissExpired = (index) => {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      timerStatus: 'none',
      timerEnd: null,
      timerDuration: null
    };
    setItems(updated);
    if (onUpdateMeeting) {
      onUpdateMeeting({
        ...meeting,
        actionItems: updated
      });
    }
  };

  // Format menu opener
  const handleOpenMenu = (index) => {
    setOpenMenuIndex(index);
    setCustomMode(false);
    setCustomDuration({ value: '5', unit: 'min' });
  };

  // Priority badge styling
  const getPriorityBadgeClass = (priority) => {
    const lower = (priority || '').toLowerCase();
    if (lower.includes('high')) return 'bg-rose-50 text-rose-700 border-rose-100';
    if (lower.includes('medium')) return 'bg-amber-50 text-amber-700 border-amber-100';
    if (lower.includes('low')) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    return 'bg-gray-50 text-gray-700 border-gray-100';
  };

  // Status badge styling
  const getStatusBadgeClass = (status) => {
    const lower = (status || '').toLowerCase();
    if (lower === 'completed') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (lower === 'in_progress') return 'bg-blue-100 text-blue-800 border-blue-200';
    return 'bg-amber-100 text-amber-800 border-amber-200'; // pending
  };

  // Format total seconds into MM:SS or HH:MM:SS
  const formatTime = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    const pad = (num) => String(num).padStart(2, '0');
    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  // Render the Timer controls and ticking cell
  const renderReminderCell = (item, index) => {
    if (item.timerStatus === 'active' && item.timerEnd) {
      const secondsLeft = Math.max(0, Math.ceil((item.timerEnd - now) / 1000));
      return (
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 border border-indigo-100 text-indigo-700">
            <span className="relative flex h-1.5 w-1.5 mr-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
            </span>
            {formatTime(secondsLeft)}
          </span>
          <button
            onClick={() => cancelTimer(index)}
            className="p-1 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
            title="Cancel Timer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }

    if (item.timerStatus === 'expired') {
      return (
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 border border-rose-100 text-rose-700 animate-pulse">
            <Bell className="w-3 h-3 mr-1" />
            Time's Up!
          </span>
          <button
            onClick={() => dismissExpired(index)}
            className="px-1.5 py-0.5 text-[10px] font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded transition-colors shadow-sm cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      );
    }

    return (
      <div className="relative">
        {openMenuIndex === index ? (
          <div className="absolute left-0 bottom-full mb-1 z-10 bg-white border border-gray-200 rounded-lg shadow-lg p-2 flex items-center gap-1 min-w-[190px]">
            {customMode ? (
              <div className="flex items-center gap-1 w-full justify-between">
                <input
                  type="number"
                  min="1"
                  value={customDuration.value}
                  onChange={(e) => setCustomDuration({ ...customDuration, value: e.target.value })}
                  className="w-10 px-1 py-0.5 border border-gray-300 rounded text-xs text-center focus:ring-1 focus:ring-blue-500 outline-none"
                />
                <select
                  value={customDuration.unit}
                  onChange={(e) => setCustomDuration({ ...customDuration, unit: e.target.value })}
                  className="border border-gray-300 rounded text-[11px] px-1 py-0.5 bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                >
                  <option value="sec">sec</option>
                  <option value="min">min</option>
                </select>
                <button
                  onClick={() => {
                    const val = parseInt(customDuration.value, 10);
                    if (isNaN(val) || val <= 0) return;
                    const secs = customDuration.unit === 'sec' ? val : val * 60;
                    startTimer(index, secs);
                    setOpenMenuIndex(null);
                  }}
                  className="p-1 bg-green-50 text-green-700 hover:bg-green-100 rounded border border-green-200 cursor-pointer"
                  title="Start"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setCustomMode(false)}
                  className="p-1 bg-gray-50 text-gray-500 hover:bg-gray-100 rounded border border-gray-200 cursor-pointer"
                  title="Back"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 w-full justify-between">
                <button
                  onClick={() => {
                    startTimer(index, 30);
                    setOpenMenuIndex(null);
                  }}
                  className="px-1.5 py-0.5 text-[10px] font-medium bg-white hover:bg-blue-50 hover:text-blue-600 rounded border border-gray-200 transition-colors cursor-pointer"
                >
                  30s
                </button>
                <button
                  onClick={() => {
                    startTimer(index, 60);
                    setOpenMenuIndex(null);
                  }}
                  className="px-1.5 py-0.5 text-[10px] font-medium bg-white hover:bg-blue-50 hover:text-blue-600 rounded border border-gray-200 transition-colors cursor-pointer"
                >
                  1m
                </button>
                <button
                  onClick={() => {
                    startTimer(index, 300);
                    setOpenMenuIndex(null);
                  }}
                  className="px-1.5 py-0.5 text-[10px] font-medium bg-white hover:bg-blue-50 hover:text-blue-600 rounded border border-gray-200 transition-colors cursor-pointer"
                >
                  5m
                </button>
                <button
                  onClick={() => setCustomMode(true)}
                  className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 rounded border border-blue-100 transition-colors cursor-pointer"
                >
                  Custom
                </button>
                <button
                  onClick={() => setOpenMenuIndex(null)}
                  className="p-0.5 text-gray-400 hover:text-gray-600 rounded cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        ) : null}
        
        <button
          onClick={() => handleOpenMenu(index)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-md transition-all cursor-pointer"
        >
          <Clock className="w-3.5 h-3.5" />
          Set Timer
        </button>
      </div>
    );
  };

  const renderTable = () => {
    if (!items || items.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-500 font-medium">No action items extracted yet.</p>
        </div>
      );
    }
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Task</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Priority</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Owner</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Deadline</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reminder</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item, index) => (
              <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{item.task}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getPriorityBadgeClass(item.priority)}`}>
                    {item.priority}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadgeClass(item.status)}`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">{item.owner}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">{item.deadline}</td>
                <td className="px-6 py-4 whitespace-nowrap">{renderReminderCell(item, index)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <button
                    onClick={() => toggleStatus(index)}
                    className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border shadow-sm transition-all cursor-pointer ${
                      item.status === 'pending'
                        ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {item.status === 'pending' ? 'Mark as Done' : 'Reopen'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fadeIn">
      {/* Header Area */}
      <div className="px-6 py-5 border-b border-gray-200 bg-gray-50/50 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-blue-600" />
            Meeting Action Items & Assignments
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Track task priorities, owners, deadlines, and set real-time countdown reminders.
          </p>
        </div>
        {!loading && !error && (
          <button
            onClick={fetchData}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-all cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Analysis
          </button>
        )}
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-blue-600"></div>
          <span className="mt-3 text-gray-600 font-semibold text-sm">Analyzing transcript...</span>
        </div>
      )}

      {error && (
        <div className="m-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800 text-sm">Analysis Error</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Main Table Content */}
      {!loading && !error && (
        <div className="p-2 sm:p-0">
          {renderTable()}
        </div>
      )}
    </div>
  );
};

export default ActionItems;
