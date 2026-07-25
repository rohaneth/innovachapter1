import React, { useState, useEffect } from 'react';

const API_URL = process.env.REACT_APP_API_URL || (window.location.port === '3000' ? 'http://localhost:8000' : window.location.origin);

const parseJsonResponse = (text) => {
  const trimmed = text.trim();
  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(match ? match[1].trim() : trimmed);
};

const ActionItems = ({ meeting }) => {
  const transcript = meeting?.transcript || '';
  const [actionItems, setActionItems] = useState(null);
  const [assignments, setAssignments] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Function to fetch both action items and owner/deadline assignments
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
      // actionData.action_items is a string containing JSON array
      const parsedActionItems = parseJsonResponse(actionData.action_items);
      setActionItems(parsedActionItems);

      // Fetch owner/deadline assignments
      const ownerRes = await fetch(`${API_URL}/api/owner-deadlines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });
      if (!ownerRes.ok) throw new Error('Failed to fetch owner/deadline assignments');
      const ownerData = await ownerRes.json();
      // ownerData.assignments is a string containing JSON array
      const parsedAssignments = parseJsonResponse(ownerData.assignments);
      setAssignments(parsedAssignments);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Automatically fetch if transcript is provided on mount or change
  useEffect(() => {
    if (transcript) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript]);

  // Render helper for action items
  const renderActionItems = () => {
    if (!actionItems) return <p>No action items extracted yet.</p>;
    if (!Array.isArray(actionItems) || actionItems.length === 0) {
      return <p>No action items found in the transcript.</p>;
    }
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#f2f2f2' }}>
            <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Task</th>
            <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Priority</th>
            <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {actionItems.map((item, index) => (
            <tr key={index}>
              <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.task || '—'}</td>
              <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.priority || '—'}</td>
              <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.status || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  // Render helper for owner/deadline assignments
  const renderAssignments = () => {
    if (!assignments) return <p>No assignments extracted yet.</p>;
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return <p>No assignments found in the transcript.</p>;
    }
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#f2f2f2' }}>
            <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Task</th>
            <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Owner</th>
            <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Deadline</th>
          </tr>
        </thead>
        <tbody>
          {assignments.map((item, index) => (
            <tr key={index}>
              <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.task || '—'}</td>
              <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.owner || '—'}</td>
              <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.deadline || '—'}</td>
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

      <div style={{ marginBottom: '40px' }}>
        <h3>Action Items</h3>
        {renderActionItems()}
      </div>

      <div>
        <h3>Owner & Deadline Assignments</h3>
        {renderAssignments()}
      </div>

      {!loading && !error && (
        <button
          onClick={fetchData}
          style={{
            marginTop: '20px',
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