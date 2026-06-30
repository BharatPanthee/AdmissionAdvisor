import { useState, useEffect, useRef } from 'react';

const API_BASE = 'http://localhost:5050/api';

function App() {
  // Auth state
  const [user, setUser] = useState(null);
  const [mockEmail, setMockEmail] = useState('student@example.com');
  const [mockName, setMockName] = useState('Jane Doe');
  
  // Custom API Key Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [customApiKey, setCustomApiKey] = useState('');

  // App navigation / view states
  // Views: 'landing', 'wizard', 'selection', 'dashboard', 'portfolio', 'billing'
  const [currentView, setCurrentView] = useState('landing');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Insufficient credits modal state
  const [creditAlert, setCreditAlert] = useState(null); // { required, current }
  
  // Profile wizard state
  const [wizardStep, setWizardStep] = useState(1);
  const [profileForm, setProfileForm] = useState({
    grade: 10,
    academicSubjects: [],
    interests: [],
    careerGoals: [],
    extracurriculars: [],
    skills: [],
    targetUniversities: []
  });
  
  // Draft restore state
  const [hasDraftNotice, setHasDraftNotice] = useState(false);
  const [pendingDraft, setPendingDraft] = useState(null);
  
  // Temporary input states for lists in wizard
  const [tempSubject, setTempSubject] = useState('');
  const [tempInterest, setTempInterest] = useState('');
  const [tempCareer, setTempCareer] = useState('');
  const [tempExtracurricular, setTempExtracurricular] = useState('');
  const [tempSkill, setTempSkill] = useState('');
  const [tempUniversity, setTempUniversity] = useState('');

  // Suggestions state
  const [suggestions, setSuggestions] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedPathway, setSelectedPathway] = useState('');
  const [customizationNotes, setCustomizationNotes] = useState('');

  // Dashboard active project state
  const [activeProject, setActiveProject] = useState(null);

  // Chat Advisor state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [advisorTyping, setAdvisorTyping] = useState(false);
  const chatEndRef = useRef(null);

  // Reflection form state
  const [reflectionLogs, setReflectionLogs] = useState({});
  // Temporary input for media attachment links
  const [tempLogLink, setTempLogLink] = useState({});

  // Portfolio state
  const [portfolioData, setPortfolioData] = useState(null);

  // Reference for debouncing auto-save
  const autoSaveTimerRef = useRef(null);

  // Load custom key and user on startup
  useEffect(() => {
    const storedUser = localStorage.getItem('astra_user');
    const storedKey = localStorage.getItem('astra_custom_key');
    
    if (storedKey) {
      setCustomApiKey(storedKey);
    }
    
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      setUser(parsed);
      checkUserFlow(parsed, storedKey);
    }
  }, []);

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  // Refresh user credits/tier from backend
  const refreshBillingStatus = async (currentUser = user) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE}/billing/info`, {
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(prev => {
          const updated = {
            ...prev,
            tier: data.tier,
            credits: data.credits
          };
          localStorage.setItem('astra_user', JSON.stringify(updated));
          return updated;
        });
      }
    } catch (err) {
      console.error("Failed to refresh billing status:", err);
    }
  };

  // Get headers including optional custom API key override
  const getHeaders = (keyOverride) => {
    const activeKey = keyOverride !== undefined ? keyOverride : customApiKey;
    const headers = {
      'Content-Type': 'application/json',
      'x-user-id': user ? user.id : 'mock-user-id-123'
    };
    if (activeKey) {
      headers['x-gemini-api-key'] = activeKey;
    }
    return headers;
  };

  // Sync profile form changes with server draft
  const triggerDraftAutoSave = (updatedForm) => {
    if (!user) return;
    
    localStorage.setItem(`astra_draft_${user.id}`, JSON.stringify(updatedForm));

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        await fetch(`${API_BASE}/profile/draft`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ draftData: updatedForm })
        });
        console.log("Draft auto-saved to database.");
      } catch (err) {
        console.error("Draft auto-save to server failed:", err);
      }
    }, 2000);
  };

  // Handle manual login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'mock-user-id-123'
        },
        body: JSON.stringify({ email: mockEmail, name: mockName })
      });
      const data = await response.json();
      if (data.success) {
        setUser(data.user);
        localStorage.setItem('astra_user', JSON.stringify(data.user));
        
        if (data.hasDraft && data.profileDraft) {
          setPendingDraft(data.profileDraft);
          setHasDraftNotice(true);
        }
        
        checkUserFlow(data.user, customApiKey);
      } else {
        setErrorMessage(data.error || 'Failed to login');
      }
    } catch (err) {
      setErrorMessage('Backend offline. Please ensure Express is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('astra_user');
    setCurrentView('landing');
    setSuggestions([]);
    setActiveProject(null);
    setChatMessages([]);
  };

  // Save custom key
  const handleSaveSettings = (e) => {
    e.preventDefault();
    localStorage.setItem('astra_custom_key', customApiKey);
    setShowSettings(false);
  };

  // Determine flow based on completed profile / active projects
  const checkUserFlow = async (currentUser, storedKey) => {
    setLoading(true);
    try {
      const profRes = await fetch(`${API_BASE}/profile`, {
        headers: { 'x-user-id': currentUser.id }
      });
      
      if (profRes.status === 444) {
        setCurrentView('wizard');
        const localDraft = localStorage.getItem(`astra_draft_${currentUser.id}`);
        if (localDraft) {
          setProfileForm(JSON.parse(localDraft));
        }
        setLoading(false);
        return;
      }
      
      const profile = await profRes.json();
      
      const projRes = await fetch(`${API_BASE}/projects/active`, {
        headers: { 'x-user-id': currentUser.id }
      });
      const projData = await projRes.json();
      
      // Sync latest billing balance
      await refreshBillingStatus(currentUser);

      if (projData.activeProject) {
        setActiveProject(projData.activeProject);
        setCurrentView('dashboard');
        fetchChatHistory(currentUser.id, storedKey);
      } else {
        fetchSuggestions(currentUser.id, storedKey);
      }
    } catch (err) {
      console.error("User flow check error:", err);
      setCurrentView('wizard');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Suggestions
  const fetchSuggestions = async (userId = user?.id, keyVal = customApiKey) => {
    setLoading(true);
    setErrorMessage('');
    try {
      const response = await fetch(`${API_BASE}/projects/suggestions`, {
        headers: getHeaders(keyVal)
      });
      
      if (response.status === 402) {
        const errorData = await response.json();
        setCreditAlert({ required: errorData.requiredCredits, current: errorData.currentCredits });
        setLoading(false);
        return;
      }

      const data = await response.json();
      if (data.suggestions) {
        setSuggestions(data.suggestions);
        setCurrentView('selection');
        refreshBillingStatus();
        if (data.suggestions.length > 0) {
          const firstProj = data.suggestions[0];
          setSelectedProjectId(firstProj.id);
          const pathways = JSON.parse(firstProj.suggestedExecutionPathways);
          if (pathways && pathways.length > 0) {
            setSelectedPathway(pathways[0]);
          }
        }
      } else {
        setErrorMessage(data.error || 'Failed to fetch suggestions');
      }
    } catch (err) {
      setErrorMessage('Error querying project recommendations.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Restore profile draft
  const restoreDraft = () => {
    if (pendingDraft) {
      setProfileForm(pendingDraft);
      localStorage.setItem(`astra_draft_${user.id}`, JSON.stringify(pendingDraft));
    }
    setHasDraftNotice(false);
  };

  // Discard draft
  const discardDraft = async () => {
    try {
      await fetch(`${API_BASE}/profile/draft`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      localStorage.removeItem(`astra_draft_${user.id}`);
      setProfileForm({
        grade: 10,
        academicSubjects: [],
        interests: [],
        careerGoals: [],
        extracurriculars: [],
        skills: [],
        targetUniversities: []
      });
    } catch (err) {
      console.error("Failed to delete draft:", err);
    } finally {
      setHasDraftNotice(false);
    }
  };

  // Input lists helpers
  const addItem = (field, value, setValue) => {
    if (!value.trim()) return;
    const newList = [...profileForm[field], value.trim()];
    const newForm = { ...profileForm, [field]: newList };
    setProfileForm(newForm);
    setValue('');
    triggerDraftAutoSave(newForm);
  };

  const removeItem = (field, index) => {
    const newList = profileForm[field].filter((_, i) => i !== index);
    const newForm = { ...profileForm, [field]: newList };
    setProfileForm(newForm);
    triggerDraftAutoSave(newForm);
  };

  // Handle profile final submission
  const handleProfileSubmit = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/profile`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(profileForm)
      });
      const data = await response.json();
      if (data.success) {
        localStorage.removeItem(`astra_draft_${user.id}`);
        fetchSuggestions();
      } else {
        setErrorMessage("Failed to finalize profile.");
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("Network error finalizing profile.");
    } finally {
      setLoading(false);
    }
  };

  // Launch project roadmap
  const handleSelectProject = async () => {
    if (!selectedProjectId || !selectedPathway) {
      alert("Please select a project and execution pathway.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/projects/select`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          projectId: selectedProjectId,
          selectedPathway,
          customizationNotes
        })
      });

      if (response.status === 402) {
        const errorData = await response.json();
        setCreditAlert({ required: errorData.requiredCredits, current: errorData.currentCredits });
        setLoading(false);
        return;
      }

      const data = await response.json();
      if (data.success) {
        setActiveProject(data.userProject);
        setCurrentView('dashboard');
        setChatMessages([]);
        setCustomizationNotes('');
        refreshBillingStatus();
      } else {
        alert(data.error || "Failed to initialize roadmap.");
      }
    } catch (err) {
      console.error(err);
      alert("Error initializing project.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch chat history
  const fetchChatHistory = async (userId, keyVal) => {
    try {
      const response = await fetch(`${API_BASE}/projects/active/chat`, {
        headers: getHeaders(keyVal)
      });
      const data = await response.json();
      if (data.chatMessages) {
        setChatMessages(data.chatMessages);
      }
    } catch (err) {
      console.error("Fetch chat history failed:", err);
    }
  };

  // Send message to AI advisor chat
  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessageText = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [...prev, { id: 'temp-usr', sender: 'USER', message: userMessageText }]);
    setAdvisorTyping(true);

    try {
      const response = await fetch(`${API_BASE}/projects/active/chat`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ message: userMessageText })
      });

      if (response.status === 4402 || response.status === 402) {
        const errorData = await response.json();
        setChatMessages((prev) => prev.filter(m => m.id !== 'temp-usr'));
        setCreditAlert({ required: errorData.requiredCredits, current: errorData.currentCredits });
        setAdvisorTyping(false);
        return;
      }

      const data = await response.json();
      if (data.success && data.message) {
        setChatMessages((prev) => 
          prev.filter(m => m.id !== 'temp-usr').concat([
            { id: 'usr-save', sender: 'USER', message: userMessageText },
            data.message
          ])
        );
        refreshBillingStatus();
      }
    } catch (err) {
      console.error("Chat message send failed:", err);
      setChatMessages((prev) => [
        ...prev, 
        { id: 'err-msg', sender: 'ADVISOR', message: 'Sorry, I failed to send that message. Please verify your internet connection.' }
      ]);
    } finally {
      setAdvisorTyping(false);
    }
  };

  // Toggle Task Checklist
  const handleToggleTask = async (taskId) => {
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}/toggle`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        const updatedMilestones = activeProject.milestones.map(ms => {
          const updatedTasks = ms.tasks.map(t => {
            if (t.id === taskId) {
              return { ...t, isCompleted: !t.isCompleted };
            }
            return t;
          });
          return { ...ms, tasks: updatedTasks };
        });
        setActiveProject({ ...activeProject, milestones: updatedMilestones });
      }
    } catch (err) {
      console.error("Task toggle error:", err);
    }
  };

  // Media link array helpers for reflection form
  const addMediaLink = (milestoneId) => {
    const link = tempLogLink[milestoneId] || '';
    if (!link.trim()) return;

    const currentMsLogs = reflectionLogs[milestoneId] || {
      learningOutcomes: '',
      challenges: '',
      solutions: '',
      resourcesUsed: '',
      mediaLinks: [],
      completeMilestone: true
    };
    const currentLinks = currentMsLogs.mediaLinks || [];
    
    setReflectionLogs({
      ...reflectionLogs,
      [milestoneId]: {
        ...currentMsLogs,
        mediaLinks: [...currentLinks, link.trim()]
      }
    });

    setTempLogLink({
      ...tempLogLink,
      [milestoneId]: ''
    });
  };

  const removeMediaLink = (milestoneId, index) => {
    const currentMsLogs = reflectionLogs[milestoneId];
    const currentLinks = currentMsLogs.mediaLinks.filter((_, i) => i !== index);
    
    setReflectionLogs({
      ...reflectionLogs,
      [milestoneId]: {
        ...currentMsLogs,
        mediaLinks: currentLinks
      }
    });
  };

  // Handle reflection log submission
  const handleLogSubmit = async (milestoneId) => {
    const inputs = reflectionLogs[milestoneId] || {
      learningOutcomes: '',
      challenges: '',
      solutions: '',
      resourcesUsed: '',
      mediaLinks: [],
      completeMilestone: true
    };

    if (!inputs.learningOutcomes || !inputs.challenges) {
      alert("Please enter both learning outcomes and challenges faced.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/milestones/${milestoneId}/log`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          learningOutcomes: inputs.learningOutcomes,
          challenges: inputs.challenges,
          solutions: inputs.solutions,
          resourcesUsed: inputs.resourcesUsed,
          mediaLinks: inputs.mediaLinks || [],
          completeMilestone: inputs.completeMilestone
        })
      });
      
      const data = await response.json();
      if (data.success) {
        const projRes = await fetch(`${API_BASE}/projects/active`, {
          headers: getHeaders()
        });
        const projData = await projRes.json();
        if (projData.activeProject) {
          setActiveProject(projData.activeProject);
        }
        setReflectionLogs({
          ...reflectionLogs,
          [milestoneId]: {
            learningOutcomes: '',
            challenges: '',
            solutions: '',
            resourcesUsed: '',
            mediaLinks: [],
            completeMilestone: true
          }
        });
      }
    } catch (err) {
      console.error("Log submission failed:", err);
      alert("Failed to submit reflection log.");
    } finally {
      setLoading(false);
    }
  };

  const handleReflectionChange = (milestoneId, field, value) => {
    const currentMsLogs = reflectionLogs[milestoneId] || {
      learningOutcomes: '',
      challenges: '',
      solutions: '',
      resourcesUsed: '',
      mediaLinks: [],
      completeMilestone: true
    };
    setReflectionLogs({
      ...reflectionLogs,
      [milestoneId]: {
        ...currentMsLogs,
        [field]: value
      }
    });
  };

  // Complete entire project & show portfolio with alignment score
  const handleCompleteProject = async () => {
    if (!confirm("Are you sure you want to complete this project? This will compile your portfolio and query Gemini for University Alignment metrics.")) {
      return;
    }
    setLoading(true);
    try {
      const completeRes = await fetch(`${API_BASE}/projects/active/complete`, {
        method: 'POST',
        headers: getHeaders()
      });

      if (completeRes.status === 402) {
        const errorData = await completeRes.json();
        setCreditAlert({ required: errorData.requiredCredits, current: errorData.currentCredits });
        setLoading(false);
        return;
      }

      const compData = await completeRes.json();
      if (compData.success) {
        const portRes = await fetch(`${API_BASE}/projects/portfolio/${activeProject.id}`, {
          headers: getHeaders()
        });
        const portData = await portRes.json();
        setPortfolioData(portData.portfolio);
        setCurrentView('portfolio');
        setActiveProject(null);
        setChatMessages([]);
        refreshBillingStatus();
      }
    } catch (err) {
      console.error("Complete project error:", err);
      alert("Error finalizing project.");
    } finally {
      setLoading(false);
    }
  };

  // Billing Actions
  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/billing/subscribe`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        refreshBillingStatus();
      }
    } catch (err) {
      console.error(err);
      alert("Subscription failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleBuyCredits = async (amount) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/billing/buy-credits`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ amount })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        refreshBillingStatus();
      }
    } catch (err) {
      console.error(err);
      alert("Top up failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      {/* HEADER */}
      <header className="app-header">
        <div className="logo-container" onClick={() => user && checkUserFlow(user)} style={{ cursor: 'pointer' }}>
          <div className="logo-icon">✦</div>
          <div className="logo-text">Astra</div>
        </div>

        {/* NAVIGATION LINKS */}
        {user && (
          <nav style={{ display: 'flex', gap: '1.5rem', marginLeft: '2rem', marginRight: 'auto' }}>
            <button 
              onClick={() => {
                if (activeProject) setCurrentView('dashboard');
                else fetchSuggestions();
              }} 
              className="nav-link"
              style={{ background: 'none', border: 'none', color: (currentView === 'dashboard' || currentView === 'selection') ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500' }}
            >
              Roadmap
            </button>
            <button 
              onClick={() => {
                setCurrentView('billing');
                refreshBillingStatus();
              }} 
              className="nav-link"
              style={{ background: 'none', border: 'none', color: currentView === 'billing' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500' }}
            >
              Billing & Account
            </button>
          </nav>
        )}

        <div className="user-status">
          {/* Credit balance visualizer */}
          {user && (
            <div 
              onClick={() => {
                setCurrentView('billing');
                refreshBillingStatus();
              }}
              style={{ 
                background: 'rgba(255,255,255,0.04)', 
                border: '1px solid rgba(255,255,255,0.08)', 
                borderRadius: '20px', 
                padding: '0.25rem 0.75rem', 
                fontSize: '0.85rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.4rem', 
                marginRight: '1rem',
                cursor: 'pointer'
              }}
              title="Click to manage billing"
            >
              <span style={{ color: '#fbbf24' }}>🪙</span>
              <strong style={{ color: '#fff' }}>{user.credits ? user.credits.toFixed(1) : '0.0'}</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>credits ({user.tier})</span>
            </div>
          )}

          <button 
            onClick={() => setShowSettings(true)} 
            className="btn btn-secondary" 
            style={{ padding: '0.4rem 0.6rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', marginRight: '0.5rem' }}
            title="Settings"
          >
            ⚙️ Settings
          </button>
          {user ? (
            <>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginRight: '0.5rem' }}>
                Hi, <strong style={{ color: '#fff' }}>{user.name.split(' ')[0]}</strong>
              </span>
              <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                Sign Out
              </button>
            </>
          ) : (
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Secure Admissions Advisor</span>
          )}
        </div>
      </header>

      {/* ERROR NOTICE */}
      {errorMessage && (
        <div style={{ margin: '1rem 2rem', padding: '1rem', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid var(--error)', borderRadius: '8px', color: '#fda4af', textAlign: 'left', fontSize: '0.9rem' }}>
          <strong>Error:</strong> {errorMessage}
        </div>
      )}

      {/* OUT OF CREDITS MODAL */}
      {creditAlert && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
          <div className="glass-panel" style={{ width: '420px', padding: '2.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🪙</div>
            <h3 style={{ fontSize: '1.4rem', color: '#fff', marginBottom: '0.75rem' }}>Credits Depleted</h3>
            <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: '1.4', marginBottom: '1.5rem' }}>
              This action requires <strong>{creditAlert.required}</strong> credit(s), but you currently have only <strong>{creditAlert.current?.toFixed(2)}</strong>.
            </p>
            <div style={{ background: 'rgba(251, 191, 36, 0.05)', border: '1px solid rgba(251, 191, 36, 0.15)', borderRadius: '6px', padding: '0.75rem', fontSize: '0.8rem', color: '#fbbf24', textAlign: 'left', marginBottom: '2rem' }}>
              <strong>Tip:</strong> Subscribe to Astra Premium to get 100 recurring monthly credits immediately, or purchase a credit package below.
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button 
                onClick={() => {
                  setCreditAlert(null);
                  setCurrentView('billing');
                }} 
                className="btn btn-primary"
              >
                Go to Billing Panel
              </button>
              <button onClick={() => setCreditAlert(null)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div className="glass-panel" style={{ width: '450px', padding: '2rem', textAlign: 'left' }}>
            <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>⚙️ Advisor Settings</h3>
            <form onSubmit={handleSaveSettings}>
              <div className="form-group">
                <label>Google Gemini API Key Override (Optional)</label>
                <input 
                  type="password" 
                  className="form-control"
                  placeholder="Paste your AI Studio GEMINI_API_KEY..."
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem', lineHeight: '1.3' }}>
                  If supplied, requests will run using your key. Leave empty to run with the advisor server's default configuration.
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '2rem' }}>
                <button type="button" onClick={() => setShowSettings(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Key</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LOADING SPINNER */}
      {loading && (
        <div style={{ padding: '4rem', textAlign: 'center' }}>
          <div className="spinner"></div>
          <p style={{ color: 'var(--text-muted)', marginTop: '1rem', fontFamily: 'var(--heading-font)' }}>Analyzing advisor database...</p>
        </div>
      )}

      {/* VIEW RENDER PIPELINE */}
      {!loading && (
        <main style={{ flex: 1 }}>
          
          {/* 1. LANDING VIEW */}
          {currentView === 'landing' && (
            <div className="landing-container">
              <h1 className="hero-title">Discover and Build Purpose-Driven Portfolios</h1>
              <p className="hero-subtitle">
                Astra is an AI-assisted admissions companion helping students in Grades 8–12 design, track, and export impactful passion projects that strengthen university applications.
              </p>
              
              <div className="glass-panel" style={{ maxWidth: '450px', margin: '0 auto', padding: '2.5rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Sign In with Google</h2>
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
                  <div className="form-group">
                    <label>Mock Gmail Address</label>
                    <input 
                      type="email" 
                      className="form-control"
                      value={mockEmail} 
                      onChange={(e) => setMockEmail(e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label>Student Full Name</label>
                    <input 
                      type="text" 
                      className="form-control"
                      value={mockName} 
                      onChange={(e) => setMockName(e.target.value)} 
                      required 
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                    Continue with Google OAuth
                  </button>
                </form>
              </div>

              <div className="features-grid">
                <div className="glass-panel feature-card">
                  <div className="feature-icon" style={{ color: 'var(--primary-hover)' }}>🎯</div>
                  <h3>AI-Assisted Suggestions</h3>
                  <p>Filter a curated library of projects matching your academic profile, skill level, and career aspirations.</p>
                </div>
                <div className="glass-panel feature-card">
                  <div className="feature-icon" style={{ color: 'var(--accent-cyan)' }}>⌥</div>
                  <h3>Pathway Execution</h3>
                  <p>Adapt projects dynamically into local campaigns, digital products, or fundraisers depending on resources.</p>
                </div>
                <div className="glass-panel feature-card">
                  <div className="feature-icon" style={{ color: 'var(--accent-emerald)' }}>📈</div>
                  <h3>Progress Tracker & Logs</h3>
                  <p>Document step-by-step milestones, check-off tasks, and compile reflective learning logs automatically.</p>
                </div>
              </div>
            </div>
          )}

          {/* 2. PROFILE WIZARD VIEW */}
          {currentView === 'wizard' && (
            <div className="wizard-container">
              <div className="glass-panel wizard-card">
                <div className="wizard-header">
                  <h2 style={{ marginBottom: '0.25rem' }}>Create Student Profile</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>This allows the advisor to filter optimal projects for you.</p>
                </div>

                <div className="progress-track">
                  <div className={`progress-step ${wizardStep >= 1 ? (wizardStep > 1 ? 'completed' : 'active') : ''}`}>1</div>
                  <div className={`progress-step ${wizardStep >= 2 ? (wizardStep > 2 ? 'completed' : 'active') : ''}`}>2</div>
                  <div className={`progress-step ${wizardStep >= 3 ? (wizardStep > 3 ? 'completed' : 'active') : ''}`}>3</div>
                  <div className={`progress-step ${wizardStep >= 4 ? (wizardStep > 4 ? 'completed' : 'active') : ''}`}>4</div>
                </div>

                {/* Step 1: Grade & Academic Subjects */}
                {wizardStep === 1 && (
                  <div>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                      Step 1: Grade & Subjects
                    </h3>
                    <div className="form-group">
                      <label>Grade Level</label>
                      <select 
                        className="form-control" 
                        value={profileForm.grade} 
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          const newForm = { ...profileForm, grade: val };
                          setProfileForm(newForm);
                          triggerDraftAutoSave(newForm);
                        }}
                      >
                        <option value="8">Grade 8</option>
                        <option value="9">Grade 9</option>
                        <option value="10">Grade 10</option>
                        <option value="11">Grade 11</option>
                        <option value="12">Grade 12</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Academic Subjects (e.g. Mathematics, AP Biology)</label>
                      <div className="tags-input-container">
                        {profileForm.academicSubjects.map((sub, i) => (
                          <span key={i} className="tag-badge">
                            {sub}
                            <button type="button" onClick={() => removeItem('academicSubjects', i)}>×</button>
                          </span>
                        ))}
                        <input 
                          type="text" 
                          placeholder="Add subject & press Enter"
                          value={tempSubject}
                          onChange={(e) => setTempSubject(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addItem('academicSubjects', tempSubject, setTempSubject);
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Universities & Careers */}
                {wizardStep === 2 && (
                  <div>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                      Step 2: Universities & Careers
                    </h3>
                    <div className="form-group">
                      <label>Target Career Goals (e.g. Biomedical Engineer, Writer)</label>
                      <div className="tags-input-container">
                        {profileForm.careerGoals.map((c, i) => (
                          <span key={i} className="tag-badge" style={{ color: 'var(--accent-cyan)', borderColor: 'rgba(6, 182, 212, 0.3)', background: 'var(--accent-cyan-glow)' }}>
                            {c}
                            <button type="button" onClick={() => removeItem('careerGoals', i)}>×</button>
                          </span>
                        ))}
                        <input 
                          type="text" 
                          placeholder="Add career goal & press Enter"
                          value={tempCareer}
                          onChange={(e) => setTempCareer(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addItem('careerGoals', tempCareer, setTempCareer);
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Interested Universities (e.g. Harvard, UC Berkeley)</label>
                      <div className="tags-input-container">
                        {profileForm.targetUniversities.map((uni, i) => (
                          <span key={i} className="tag-badge" style={{ color: 'var(--accent-cyan)', borderColor: 'rgba(6, 182, 212, 0.3)', background: 'var(--accent-cyan-glow)' }}>
                            {uni}
                            <button type="button" onClick={() => removeItem('targetUniversities', i)}>×</button>
                          </span>
                        ))}
                        <input 
                          type="text" 
                          placeholder="Add university & press Enter"
                          value={tempUniversity}
                          onChange={(e) => setTempUniversity(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addItem('targetUniversities', tempUniversity, setTempUniversity);
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Interests & Skills */}
                {wizardStep === 3 && (
                  <div>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                      Step 3: Interests & Skills
                    </h3>
                    <div className="form-group">
                      <label>Personal Interests & Hobbies (e.g. Coding, Drawing, Composting)</label>
                      <div className="tags-input-container">
                        {profileForm.interests.map((int, i) => (
                          <span key={i} className="tag-badge">
                            {int}
                            <button type="button" onClick={() => removeItem('interests', i)}>×</button>
                          </span>
                        ))}
                        <input 
                          type="text" 
                          placeholder="Add interest & press Enter"
                          value={tempInterest}
                          onChange={(e) => setTempInterest(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addItem('interests', tempInterest, setTempInterest);
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Current Skills (e.g. Python, Public Speaking, Writing)</label>
                      <div className="tags-input-container">
                        {profileForm.skills.map((skill, i) => (
                          <span key={i} className="tag-badge">
                            {skill}
                            <button type="button" onClick={() => removeItem('skills', i)}>×</button>
                          </span>
                        ))}
                        <input 
                          type="text" 
                          placeholder="Add skill & press Enter"
                          value={tempSkill}
                          onChange={(e) => setTempSkill(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addItem('skills', tempSkill, setTempSkill);
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4: Extracurricular Activities */}
                {wizardStep === 4 && (
                  <div>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                      Step 4: Extracurricular Activities
                    </h3>
                    <div className="form-group">
                      <label>Clubs, Competitions & Volunteering (e.g. Debate Team, Coding Club)</label>
                      <div className="tags-input-container">
                        {profileForm.extracurriculars.map((ex, i) => (
                          <span key={i} className="tag-badge" style={{ color: 'var(--accent-emerald)', borderColor: 'rgba(16, 185, 129, 0.3)', background: 'var(--accent-emerald-glow)' }}>
                            {ex}
                            <button type="button" onClick={() => removeItem('extracurriculars', i)}>×</button>
                          </span>
                        ))}
                        <input 
                          type="text" 
                          placeholder="Add activity & press Enter"
                          value={tempExtracurricular}
                          onChange={(e) => setTempExtracurricular(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addItem('extracurriculars', tempExtracurricular, setTempExtracurricular);
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="form-actions">
                  {wizardStep > 1 ? (
                    <button onClick={() => setWizardStep(wizardStep - 1)} className="btn btn-secondary">
                      ← Back
                    </button>
                  ) : (
                    <div></div>
                  )}

                  {wizardStep < 4 ? (
                    <button onClick={() => setWizardStep(wizardStep + 1)} className="btn btn-accent">
                      Next Step →
                    </button>
                  ) : (
                    <button onClick={handleProfileSubmit} className="btn btn-primary">
                      ✓ Find Advisor Suggestions
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 3. PROJECT SELECTION VIEW */}
          {currentView === 'selection' && (
            <div className="suggestions-container">
              <h1 className="text-center" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>AI-Assisted Suggestions</h1>
              <p className="text-center" style={{ color: 'var(--text-muted)', marginBottom: '3rem' }}>
                We analyzed your grade, skills, and target career goals. Here are the top purpose-driven projects matching your profile:
              </p>

              <div className="suggestions-grid">
                {suggestions.map((sug) => (
                  <div 
                    key={sug.id} 
                    className="glass-panel suggestion-card"
                    style={{ 
                      borderColor: selectedProjectId === sug.id ? 'var(--primary)' : 'var(--panel-border)',
                      background: selectedProjectId === sug.id ? 'rgba(139, 92, 246, 0.05)' : 'var(--panel-bg)'
                    }}
                    onClick={() => {
                      setSelectedProjectId(sug.id);
                      const pathways = JSON.parse(sug.suggestedExecutionPathways);
                      if (pathways && pathways.length > 0) {
                        setSelectedPathway(pathways[0]);
                      }
                    }}
                  >
                    <div className="suggestion-header">
                      <div>
                        <span className="suggestion-badge" style={{ marginRight: '0.5rem' }}>{sug.category}</span>
                        <span className="suggestion-badge score-badge">Match: {Math.round(sug.relevanceScore * 100)}%</span>
                      </div>
                      <h3 style={{ fontSize: '1.5rem', margin: '0.5rem 0 0 0' }}>{sug.title}</h3>
                    </div>

                    <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', margin: '1rem 0' }}>{sug.description}</p>
                    
                    <div className="reasoning-box">
                      <strong>Advisor Analysis:</strong> {sug.reasoning}
                    </div>

                    {selectedProjectId === sug.id && (
                      <div className="pathways-selection" onClick={(e) => e.stopPropagation()}>
                        <h4 style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '1rem' }}>Select Execution Pathway</h4>
                        {JSON.parse(sug.suggestedExecutionPathways).map((pathway, index) => (
                          <div 
                            key={index} 
                            className={`pathway-option ${selectedPathway === pathway ? 'selected' : ''}`}
                            onClick={() => setSelectedPathway(pathway)}
                          >
                            <input 
                              type="radio" 
                              name="pathway" 
                              checked={selectedPathway === pathway} 
                              onChange={() => setSelectedPathway(pathway)} 
                            />
                            <label>{pathway}</label>
                          </div>
                        ))}

                        <div className="form-group" style={{ marginTop: '1.5rem' }}>
                          <label>Customization Details / Local Constraints (Optional)</label>
                          <textarea 
                            className="form-control" 
                            rows="2"
                            placeholder="e.g., I only have 4 hours a week / I want to work with 5 classmates."
                            value={customizationNotes}
                            onChange={(e) => setCustomizationNotes(e.target.value)}
                          ></textarea>
                        </div>

                        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                          <button onClick={handleSelectProject} className="btn btn-primary btn-emerald">
                            🚀 Select Project & Build Roadmap
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. ACTIVE DASHBOARD VIEW (DOUBLE COLUMN WITH SIDEBAR CHAT) */}
          {currentView === 'dashboard' && activeProject && (
            <div className="dashboard-container" style={{ maxWidth: '1250px', display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2rem' }}>
              
              {/* LEFT SIDE: ROADMAP TIMELINE */}
              <div>
                <div className="glass-panel project-overview-panel">
                  <div className="project-meta-pills">
                    <span className="pill" style={{ color: 'var(--primary-hover)', background: 'var(--primary-glow)' }}>{activeProject.project.category}</span>
                    <span className="pill">Pathway: {activeProject.selectedPathway}</span>
                    <span className="pill" style={{ color: 'var(--accent-cyan)', background: 'var(--accent-cyan-glow)' }}>Status: Active Execution</span>
                  </div>
                  <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{activeProject.project.title}</h1>
                  <p style={{ color: 'var(--text-main)', marginBottom: '1.5rem', fontSize: '1rem' }}>{activeProject.project.description}</p>
                  
                  {activeProject.customizationNotes && (
                    <div style={{ padding: '1rem', background: 'rgba(6, 182, 212, 0.05)', borderLeft: '3px solid var(--accent-cyan)', borderRadius: '4px', fontSize: '0.9rem' }}>
                      <strong style={{ color: 'var(--accent-cyan)' }}>Advisor Portfolio Strategy:</strong> {activeProject.customizationNotes}
                    </div>
                  )}
                </div>

                <h2 style={{ fontSize: '1.8rem', marginBottom: '2rem', textAlign: 'left' }}>Milestone-Based Roadmap</h2>

                <div className="roadmap-timeline">
                  {activeProject.milestones.map((ms) => (
                    <div 
                      key={ms.id} 
                      className={`milestone-node ${ms.status.toLowerCase().replace('_', '-')}`}
                    >
                      <div className="milestone-order">
                        <span className="order-num">{ms.sequenceOrder}</span>
                        <span className="order-weeks">{ms.estimatedDurationWeeks} wks</span>
                      </div>

                      <div className="glass-panel milestone-content-card">
                        <div className="milestone-header">
                          <div>
                            <h3 style={{ fontSize: '1.3rem', margin: 0 }}>{ms.title}</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>{ms.description}</p>
                          </div>
                          <span className="milestone-status-badge">{ms.status}</span>
                        </div>

                        {/* Tasks Checklist */}
                        <div className="tasks-list">
                          <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem', color: '#fff' }}>Milestone Tasks</h4>
                          {ms.tasks.map((task) => (
                            <div key={task.id} className={`task-item ${task.isCompleted ? 'completed' : ''}`}>
                              <input 
                                type="checkbox" 
                                id={task.id} 
                                checked={task.isCompleted} 
                                disabled={ms.status === 'NOT_STARTED'}
                                onChange={() => handleToggleTask(task.id)}
                              />
                              <label htmlFor={task.id}>{task.title}</label>
                            </div>
                          ))}
                        </div>

                        {/* Suggested Resources */}
                        <div className="resources-box">
                          <h4 style={{ fontSize: '0.95rem', marginBottom: '0.25rem', color: '#fff' }}>Recommended Resources</h4>
                          <div className="resources-list">
                            {ms.status !== 'NOT_STARTED' ? (
                              ['Google', 'Notion', 'GitHub'].map((resItem, i) => (
                                <a 
                                  key={i} 
                                  href={`https://www.${resItem.toLowerCase()}.com`} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="resource-chip"
                                >
                                  🔗 {resItem} Guide
                                </a>
                              ))
                            ) : (
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Locked until milestone unlocks</span>
                            )}
                          </div>
                        </div>

                        {/* Reflections Logs Section */}
                        <div className="reflection-section">
                          <h4 style={{ fontSize: '1rem', color: '#fff', marginBottom: '1rem' }}>Reflection Logs</h4>
                          
                          {/* List previously submitted logs */}
                          {ms.reflectionLogs.map((log) => {
                            const links = log.mediaLinks ? JSON.parse(log.mediaLinks) : [];
                            return (
                              <div key={log.id} className="log-entry">
                                <div style={{ display: 'flex', justifycontent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  <span>Log entry logged on {new Date(log.createdAt).toLocaleDateString()}</span>
                                </div>
                                <div className="log-entry-grid">
                                  <div className="log-field">
                                    <h5>Learning Outcomes</h5>
                                    <p>{log.learningOutcomes}</p>
                                  </div>
                                  <div className="log-field">
                                    <h5>Challenges</h5>
                                    <p>{log.challenges}</p>
                                  </div>
                                  {log.solutions && (
                                    <div className="log-field" style={{ gridColumn: 'span 2', marginTop: '0.5rem' }}>
                                      <h5>Solutions</h5>
                                      <p>{log.solutions}</p>
                                    </div>
                                  )}
                                  {links.length > 0 && (
                                    <div style={{ gridColumn: 'span 2', marginTop: '0.75rem' }}>
                                      <h5 style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Attachments / Proof of Work</h5>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        {links.map((linkUrl, lIdx) => (
                                          <a key={lIdx} href={linkUrl} target="_blank" rel="noreferrer" className="resource-chip" style={{ color: 'var(--accent-cyan)' }}>
                                            🔗 {linkUrl.replace('https://', '').replace('http://', '').split('/')[0]}
                                          </a>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                          {/* Submit reflection form */}
                          {ms.status === 'IN_PROGRESS' && (
                            <div className="reflection-form">
                              <h5 style={{ fontSize: '0.9rem', color: 'var(--primary-hover)', margin: '0 0 0.5rem 0' }}>Log Milestone Reflection</h5>
                              <div className="form-row">
                                <div className="form-group">
                                  <label style={{ fontSize: '0.85rem' }}>Learning Outcomes / Accomplishments</label>
                                  <textarea 
                                    className="form-control" 
                                    rows="2"
                                    placeholder="What did you learn? What skills did you develop?"
                                    value={reflectionLogs[ms.id]?.learningOutcomes || ''}
                                    onChange={(e) => handleReflectionChange(ms.id, 'learningOutcomes', e.target.value)}
                                  ></textarea>
                                </div>
                                <div className="form-group">
                                  <label style={{ fontSize: '0.85rem' }}>Challenges Encountered</label>
                                  <textarea 
                                    className="form-control" 
                                    rows="2"
                                    placeholder="What went wrong? What blocks did you face?"
                                    value={reflectionLogs[ms.id]?.challenges || ''}
                                    onChange={(e) => handleReflectionChange(ms.id, 'challenges', e.target.value)}
                                  ></textarea>
                                </div>
                              </div>
                              <div className="form-row">
                                <div className="form-group">
                                  <label style={{ fontSize: '0.85rem' }}>Solutions Implemented (Optional)</label>
                                  <textarea 
                                    className="form-control" 
                                    rows="2"
                                    placeholder="How did you overcome the obstacles?"
                                    value={reflectionLogs[ms.id]?.solutions || ''}
                                    onChange={(e) => handleReflectionChange(ms.id, 'solutions', e.target.value)}
                                  ></textarea>
                                </div>
                                <div className="form-group">
                                  <label style={{ fontSize: '0.85rem' }}>Resources / Tools Used</label>
                                  <input 
                                    type="text" 
                                    className="form-control"
                                    placeholder="e.g. YouTube tutorials, library, React docs"
                                    value={reflectionLogs[ms.id]?.resourcesUsed || ''}
                                    onChange={(e) => handleReflectionChange(ms.id, 'resourcesUsed', e.target.value)}
                                  />
                                </div>
                              </div>

                              {/* Media & Link attachments block */}
                              <div className="form-group">
                                <label style={{ fontSize: '0.85rem' }}>Attachments & Links (Proof of Work)</label>
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                  <input 
                                    type="url"
                                    className="form-control"
                                    placeholder="Add URL link (e.g. https://github.com/myproject)"
                                    value={tempLogLink[ms.id] || ''}
                                    onChange={(e) => setTempLogLink({ ...tempLogLink, [ms.id]: e.target.value })}
                                  />
                                  <button type="button" onClick={() => addMediaLink(ms.id)} className="btn btn-secondary">
                                    Add Link
                                  </button>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                  {(reflectionLogs[ms.id]?.mediaLinks || []).map((linkUrl, i) => (
                                    <span key={i} className="tag-badge" style={{ color: 'var(--accent-cyan)', borderColor: 'rgba(6, 182, 212, 0.3)', background: 'var(--accent-cyan-glow)' }}>
                                      {linkUrl.length > 30 ? linkUrl.substring(0, 30) + '...' : linkUrl}
                                      <button type="button" onClick={() => removeMediaLink(ms.id, i)}>×</button>
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                                  <input 
                                    type="checkbox" 
                                    checked={reflectionLogs[ms.id]?.completeMilestone !== false} 
                                    onChange={(e) => handleReflectionChange(ms.id, 'completeMilestone', e.target.checked)} 
                                  />
                                  Mark this milestone completed & unlock next stage
                                </label>
                                <button 
                                  onClick={() => handleLogSubmit(ms.id)} 
                                  className="btn btn-primary"
                                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                                >
                                  Submit Log Entry
                              </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: '4rem', padding: '2rem', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Ready to Submit the Project?</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>This compiles all milestone reflections and university alignment scoring details.</p>
                  </div>
                  <button onClick={handleCompleteProject} className="btn btn-emerald btn-primary">
                    🏆 Finalize Project & Export Portfolio
                  </button>
                </div>
              </div>

              {/* RIGHT SIDE: CHAT ADVISOR WIDGET */}
              <div 
                className="glass-panel" 
                style={{ 
                  height: 'calc(100vh - 120px)', 
                  position: 'sticky', 
                  top: '100px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  padding: '1.25rem',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem', marginBottom: '0.75rem', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>💬 Advisor Assistant</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Ask Astra questions regarding your roadmap.</p>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                    0.1🪙/msg
                  </div>
                </div>

                {/* Messages Box */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.25rem', marginBottom: '0.75rem' }}>
                  {chatMessages.length === 0 ? (
                    <div style={{ margin: 'auto', padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      👋 Hi! I am Astra, your academic admissions assistant. Ask me questions about your tasks or how to present this project to universities.
                    </div>
                  ) : (
                    chatMessages.map((msg, idx) => (
                      <div 
                        key={idx} 
                        style={{ 
                          alignSelf: msg.sender === 'USER' ? 'flex-end' : 'flex-start',
                          maxWidth: '85%',
                          padding: '0.6rem 0.8rem',
                          borderRadius: '12px',
                          borderTopRightRadius: msg.sender === 'USER' ? '2px' : '12px',
                          borderTopLeftRadius: msg.sender === 'ADVISOR' ? '2px' : '12px',
                          background: msg.sender === 'USER' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                          border: msg.sender === 'ADVISOR' ? '1px solid rgba(255,255,255,0.05)' : 'none',
                          fontSize: '0.85rem',
                          lineHeight: '1.4',
                          textAlign: 'left',
                          color: '#fff'
                        }}
                      >
                        {msg.message}
                      </div>
                    ))
                  )}
                  {advisorTyping && (
                    <div style={{ alignSelf: 'flex-start', maxWidth: '85%', padding: '0.6rem 0.8rem', borderRadius: '12px', borderTopLeftRadius: '2px', background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--primary)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Astra is analyzing... 🌀
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input form */}
                <form onSubmit={handleSendChatMessage} style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', height: '36px' }}
                    placeholder="Ask advisor..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: '0 0.75rem', height: '36px' }}>
                    Send
                  </button>
                </form>
              </div>

            </div>
          )}

          {/* 5. PORTFOLIO COMPLETED VIEW */}
          {currentView === 'portfolio' && portfolioData && (
            <div className="portfolio-container">
              <div className="print-notice">
                📄 Print this screen or save it to PDF (`Cmd/Ctrl + P`) for your university portal or competition boards.
              </div>

              <div className="portfolio-report">
                <div className="metadata-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h1 style={{ fontSize: '2rem', color: '#1e293b', marginBottom: '0.25rem' }}>PORTFOLIO REPORT</h1>
                      <h2 style={{ fontSize: '1.25rem', color: '#6366f1', margin: 0 }}>{portfolioData.project.title}</h2>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#64748b' }}>
                      <p><strong>Student:</strong> {portfolioData.user.name}</p>
                      <p><strong>Academic Level:</strong> Grade {portfolioData.user.profile?.grade || 10}</p>
                      <p><strong>Date Completed:</strong> {new Date(portfolioData.updatedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                {/* Premium University Alignment score details card */}
                {portfolioData.alignmentScoreDetails && (() => {
                  const alignment = JSON.parse(portfolioData.alignmentScoreDetails);
                  return (
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '2rem', marginBottom: '2.5rem', display: 'grid', gridTemplateColumns: '150px 1fr', gap: '2rem', alignItems: 'center' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ width: '100px', height: '100px', borderRadius: '50%', border: '6px solid #6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                          <span style={{ fontSize: '1.8rem', fontWeight: '800', color: '#1e293b' }}>{alignment.matchScore}%</span>
                        </div>
                        <p style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginTop: '0.75rem', textTransform: 'uppercase' }}>University Match</p>
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <h3 style={{ fontSize: '1.2rem', color: '#1e293b', margin: '0 0 0.5rem 0' }}>University Alignment Evaluation</h3>
                        <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: '1.4', margin: 0 }}>
                          {alignment.valueAlignment}
                        </p>
                        
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', margin: '1rem 0' }}>
                          {(alignment.strengthsHighlighted || []).map((str, idx) => (
                            <span key={idx} style={{ background: '#e0e7ff', color: '#4338ca', fontSize: '0.75rem', fontWeight: '600', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                              ✦ {str}
                            </span>
                          ))}
                        </div>

                        <div style={{ fontSize: '0.85rem', color: '#64748b', background: '#fff', border: '1px dashed #cbd5e1', padding: '0.75rem', borderRadius: '6px' }}>
                          <strong>Application Recommendations:</strong> {alignment.portfolioRecommendations}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div style={{ marginBottom: '2.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                    Project Specifications & Pathways
                  </h3>
                  <p style={{ fontSize: '0.95rem', color: '#475569', lineHeight: '1.5', margin: '0.75rem 0' }}>
                    {portfolioData.project.description}
                  </p>
                  <p style={{ fontSize: '0.9rem', color: '#4f46e5' }}>
                    <strong>Execution Approach:</strong> {portfolioData.selectedPathway}
                  </p>
                  {portfolioData.customizationNotes && (
                    <div style={{ padding: '0.75rem', background: '#f8fafc', borderLeft: '3px solid #6366f1', fontSize: '0.85rem', color: '#64748b', marginTop: '0.5rem' }}>
                      <strong>Advisor Alignment Strategy:</strong> {portfolioData.customizationNotes}
                    </div>
                  )}
                </div>

                <div>
                  <h3 style={{ fontSize: '1.1rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
                    Milestone Logs & Reflections
                  </h3>
                  
                  {portfolioData.milestones.map((ms) => (
                    <div key={ms.id} className="milestone-block">
                      <h4 style={{ fontSize: '1.1rem', color: '#1e293b', margin: 0 }}>
                        Milestone {ms.sequenceOrder}: {ms.title}
                      </h4>
                      <p className="tasks-completed-count">
                        ✓ {ms.tasks.filter(t => t.isCompleted).length} of {ms.tasks.length} tasks verified as completed (Duration: {ms.estimatedDurationWeeks} Weeks)
                      </p>

                      {ms.reflectionLogs.map((log) => {
                        const links = log.mediaLinks ? JSON.parse(log.mediaLinks) : [];
                        return (
                          <div key={log.id} className="reflection-block">
                            <div className="reflection-title">Learning Outcomes & Accomplishments</div>
                            <p className="reflection-text">{log.learningOutcomes}</p>
                            
                            <div className="reflection-title">Challenges Overcome</div>
                            <p className="reflection-text">{log.challenges}</p>

                            {log.solutions && (
                              <>
                                <div className="reflection-title">Solutions Implemented</div>
                                <p className="reflection-text">{log.solutions}</p>
                              </>
                            )}

                            {log.resourcesUsed && (
                              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.5rem 0 0 0' }}>
                                <strong>Resources Explored:</strong> {log.resourcesUsed}
                              </p>
                            )}

                            {links.length > 0 && (
                              <div style={{ marginTop: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem' }}>
                                <div className="reflection-title" style={{ fontSize: '0.75rem' }}>Proof of Work Attachments</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.25rem' }}>
                                  {links.map((linkUrl, lIdx) => (
                                    <a key={lIdx} href={linkUrl} target="_blank" rel="noreferrer" style={{ background: '#f1f5f9', color: '#6366f1', fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                                      🔗 {linkUrl.length > 35 ? linkUrl.substring(0, 35) + '...' : linkUrl}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div className="print-actions" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2.5rem' }}>
                <button onClick={() => fetchSuggestions()} className="btn btn-secondary">
                  ← Back to Project Database
                </button>
                <button onClick={() => window.print()} className="btn btn-primary btn-emerald">
                  Print / Save to PDF
                </button>
              </div>
            </div>
          )}

          {/* 6. BILLING & ACCOUNT VIEW */}
          {currentView === 'billing' && user && (
            <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '0 1rem', textAlign: 'left' }}>
              <h1 style={{ fontSize: '2.2rem', color: '#fff', marginBottom: '0.5rem' }}>🪙 Billing & Account</h1>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem' }}>Manage your plan, check credit usage rates, or top-up tokens.</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2.5rem' }}>
                {/* Account Details Card */}
                <div className="glass-panel" style={{ padding: '1.75rem' }}>
                  <h3 style={{ fontSize: '1.2rem', color: '#fff', margin: '0 0 1rem 0' }}>Plan Status</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ background: user.tier === 'PREMIUM' ? 'var(--primary-glow)' : 'rgba(255,255,255,0.05)', color: user.tier === 'PREMIUM' ? 'var(--primary-hover)' : 'var(--text-muted)', border: '1px solid currentColor', borderRadius: '4px', padding: '0.3rem 0.6rem', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase' }}>
                      {user.tier} Plan
                    </div>
                    {user.tier === 'FREE' && (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Upgrade for unlimited access</span>
                    )}
                  </div>
                  
                  {user.tier === 'FREE' ? (
                    <button onClick={handleSubscribe} className="btn btn-primary" style={{ width: '100%' }}>
                      Upgrade to Premium ($15/mo)
                    </button>
                  ) : (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Subscription active. Renewing automatically. <br />
                      Stripe Ref: <code>{user.stripeSubscriptionId || 'N/A'}</code>
                    </div>
                  )}
                </div>

                {/* Token Balances Card */}
                <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', justifycontent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', color: '#fff', margin: '0 0 0.5rem 0' }}>Advisor Tokens</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 1rem 0' }}>Deducted dynamically based on AI model interactions.</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '3rem', fontWeight: '800', color: '#34d399' }}>{user.credits ? user.credits.toFixed(1) : '0.0'}</span>
                    <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Tokens Left</span>
                  </div>
                </div>
              </div>

              {/* Buying Top ups Card */}
              <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2.5rem' }}>
                <h3 style={{ fontSize: '1.3rem', color: '#fff', margin: '0 0 0.5rem 0' }}>Top Up Token Balance</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Need more evaluations? Buy credit bundles instantly below.</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div className="glass-panel" style={{ padding: '1.25rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}>
                    <h4 style={{ fontSize: '1rem', margin: '0 0 0.25rem 0' }}>Starter Pack</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>50 Credits</p>
                    <div style={{ fontSize: '1.3rem', fontWeight: '700', color: '#fff', marginBottom: '1rem' }}>$4.99</div>
                    <button onClick={() => handleBuyCredits(50)} className="btn btn-secondary" style={{ width: '100%', fontSize: '0.85rem' }}>Buy Pack</button>
                  </div>
                  <div className="glass-panel" style={{ padding: '1.25rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}>
                    <h4 style={{ fontSize: '1rem', margin: '0 0 0.25rem 0' }}>Growth Pack</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>120 Credits</p>
                    <div style={{ fontSize: '1.3rem', fontWeight: '700', color: '#fff', marginBottom: '1rem' }}>$9.99</div>
                    <button onClick={() => handleBuyCredits(120)} className="btn btn-secondary" style={{ width: '100%', fontSize: '0.85rem' }}>Buy Pack</button>
                  </div>
                  <div className="glass-panel" style={{ padding: '1.25rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}>
                    <h4 style={{ fontSize: '1rem', margin: '0 0 0.25rem 0' }}>Professional Pack</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>300 Credits</p>
                    <div style={{ fontSize: '1.3rem', fontWeight: '700', color: '#fff', marginBottom: '1rem' }}>$19.99</div>
                    <button onClick={() => handleBuyCredits(300)} className="btn btn-primary btn-emerald" style={{ width: '100%', fontSize: '0.85rem' }}>Buy Pack</button>
                  </div>
                </div>
              </div>

              {/* Deductions rate documentation table */}
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', color: '#fff', margin: '0 0 1rem 0' }}>Token Deduction Rates</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '0.5rem 0' }}>Interaction Type</th>
                      <th style={{ padding: '0.5rem 0' }}>Cost (Tokens)</th>
                      <th style={{ padding: '0.5rem 0' }}>Frequency</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '0.75rem 0' }}>AI Advisor Suggestions Ranking</td>
                      <td style={{ padding: '0.75rem 0', fontWeight: '600', color: '#fbbf24' }}>1.0 🪙</td>
                      <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)' }}>Per profile analysis request</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '0.75rem 0' }}>Dynamic Roadmap Milestone Generation</td>
                      <td style={{ padding: '0.75rem 0', fontWeight: '600', color: '#fbbf24' }}>1.0 🪙</td>
                      <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)' }}>Per project initialization</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '0.75rem 0' }}>AI Advisor Chat Assistant Message</td>
                      <td style={{ padding: '0.75rem 0', fontWeight: '600', color: '#fbbf24' }}>0.1 🪙</td>
                      <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)' }}>Per message reply generated</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.75rem 0' }}>University Portfolio Alignment Scoring</td>
                      <td style={{ padding: '0.75rem 0', fontWeight: '600', color: '#fbbf24' }}>2.0 🪙</td>
                      <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)' }}>Upon compiling final portfolio dossier</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </main>
      )}

      {/* TOAST POPUP (Resumable Profile Restoration Notification) */}
      {hasDraftNotice && (
        <div className="toast-popup">
          <p>
            <strong>Complete your profile:</strong> Continue from where you left off. We saved your draft entries from your last session.
          </p>
          <div className="toast-buttons">
            <button onClick={restoreDraft} className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
              Restore Draft
            </button>
            <button onClick={discardDraft} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
              Discard Draft
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
