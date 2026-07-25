import React, { useState, useEffect } from 'react';

const API_URL = process.env.REACT_APP_API_URL || (window.location.port === '3000' ? 'http://localhost:8000' : window.location.origin);

const parseJsonResponse = (text) => {
  const trimmed = text.trim();
  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(match ? match[1].trim() : trimmed);
};

const ActionItems = ({ meeting, onUpdateMeeting }) => {
  const transcript = meeting?.transcript || '';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
      const parsedActions = parseJsonResponse(actionData.action_items);

      // Fetch owner/deadline assignments
      const ownerRes = await fetch(`${API_URL}/api/owner-deadlines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });
      if (!ownerRes.ok) throw new Error('Failed to fetch owner/deadline assignments');
      const ownerData = await ownerRes.json();
      const parsedAssignments = parseJsonResponse(ownerData.assignments);

      // Merge
      const merged = parsedActions.map(action => {
        const assignment = parsedAssignments.find(a => a.task === action.task) || {};
        return {
          task: action.task || '—',
          priority: action.priority || '—',
          status: action.status || 'pending',
          owner: assignment.owner || '—',
          deadline: assignment.deadline || '—',
        };
      });

      setItems(merged);
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

  // Load existing items or auto‑fetch on mount/change
  useEffect(() => {
    if (meeting?.actionItems && meeting.actionItems.length > 0) {
      setItems(meeting.actionItems);
    } else if (transcript) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting?.id]);

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

  // ─── NEW: Send email reminder ──────────────────────────────────────────────
  const sendReminder = async (item) => {
    // Prompt user for the recipient email address
    const email = window.prompt('Enter the recipient email address:');
    if (!email) return; // user cancelled

    try {
      const response = await fetch(`${API_URL}/api/send-reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          task: item.task,
          owner: item.owner,
          priority: item.priority,
          status: item.status,
          deadline: item.deadline,
        }),
      });

      if (!response.ok) throw new Error('Failed to send reminder');
      alert('Reminder sent successfully!');
    } catch (err) {
      alert(`Error sending reminder: ${err.message}`);
    }
  };
  // ─────────────────────────────────────────────────────────────────────────────

  const renderTable = () => {
    if (!items || items.length === 0) {
      return <p>No action items extracted yet.</p>;
    }

    return (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#f2f2f2' }}>
            <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Task</th>
            <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Priority</th>
            <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Status</th>
            <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Owner</th>
            <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Deadline</th>
            <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Action</th>
            <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Reminder</th>  {/* NEW */}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.task}</td>
              <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.priority}</td>
              <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                <span style={{
                  backgroundColor: item.status === 'completed' ? '#10b981' : '#f59e0b',
                  color: '#fff',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold'
                }}>
                  {item.status}
                </span>
              </td>
              <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.owner}</td>
              <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.deadline}</td>
              <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                <button
                  onClick={() => toggleStatus(index)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: item.status === 'pending' ? '#3b82f6' : '#6b7280',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                >
                  {item.status === 'pending' ? 'Mark as Done' : 'Reopen'}
                </button>
              </td>
              <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                <button
                  onClick={() => sendReminder(item)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: '#10b981',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                >
                  Send Reminder
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2>Meeting Action Items & Assignments</h2>

      {loading && <p>Loading analysis...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      <div style={{ marginBottom: '20px' }}>
        {renderTable()}
      </div>

      {!loading && !error && (
        <button
          onClick={fetchData}
          style={{
            marginTop: '10px',
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Refresh Analysis
        </button>
      )}
    </div>
  );
};

export default ActionItems;