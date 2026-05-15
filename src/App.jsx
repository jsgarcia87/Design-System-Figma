import { useState, useMemo, useEffect } from 'react';
import {
  Palette,
  Type,
  Box,
  Download,
  Settings,
  Loader2,
  Check,
  Copy,
  Search,
  Zap,
  GitPullRequest,
  Monitor,
  Command,
  Layers,
  Sparkles,
  FileText,
  FileCode,
  ExternalLink,
  Globe,
  Menu,
  X,
  UploadCloud,
  ArrowLeft,
  Shield,
  Scale
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import { fetchFigmaFile, extractTokens, fetchFigmaImages, fetchFigmaVariables, pushTokensToFigma } from './services/figma';

// Mock data for Demo Mode
const MOCK_TOKENS = {
  colors: [
    { name: 'Brand Primary', hex: '#A78BFA', r: 167, g: 139, b: 250 },
    { name: 'Brand Secondary', hex: '#22D3EE', r: 34, g: 211, b: 238 },
    { name: 'Bg App', hex: '#050505', r: 5, g: 5, b: 5 },
    { name: 'Bg Surface', hex: '#0F0F12', r: 15, g: 15, b: 18 },
    { name: 'Success', hex: '#34D399', r: 52, g: 211, b: 153 },
    { name: 'Warning', hex: '#FBBF24', r: 251, g: 191, b: 36 },
    { name: 'Error', hex: '#F87171', r: 248, g: 113, b: 113 },
  ],
  typography: [
    { name: 'Display XL', fontFamily: 'Outfit', fontSize: 64, fontWeight: 800 },
    { name: 'Heading L', fontFamily: 'Outfit', fontSize: 32, fontWeight: 700 },
    { name: 'Body M', fontFamily: 'Inter', fontSize: 16, fontWeight: 400 },
    { name: 'Mono Code', fontFamily: 'JetBrains Mono', fontSize: 14, fontWeight: 400 },
  ],
  components: [
    { id: '1', name: 'Primary Button', type: 'COMPONENT' },
    { id: '2', name: 'Nav Bar', type: 'COMPONENT' },
    { id: '3', name: 'Glass Card', type: 'COMPONENT' },
    { id: '4', name: 'Search Input', type: 'COMPONENT' },
  ],
  fileInfo: {
    name: 'Untitled Design System',
    lastModified: new Date().toISOString(),
    thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=400'
  }
};

const App = () => {
  const [apiKey, setApiKey] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tokens, setTokens] = useState(null);
  const [componentImages, setComponentImages] = useState({});
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [figmaFileId, setFigmaFileId] = useState('');
  const [pushing, setPushing] = useState(false);
  const [pushMsg, setPushMsg] = useState(null);
  const [route, setRoute] = useState(window.location.pathname);

  useEffect(() => {
    const onPop = () => setRoute(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = (path) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setRoute(path);
    window.scrollTo(0, 0);
  };

  const extractFileId = (url) => {
    const match = url.match(/(?:file|design)\/([a-zA-Z0-9]+)/);
    if (match) return match[1];
    if (/^[a-zA-Z0-9]+$/.test(url)) return url;
    return url;
  };

  const handleGenerate = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    setPushMsg(null);

    const cleanApiKey = apiKey.trim();
    const cleanFileUrl = fileUrl.trim();

    try {
      const fileId = extractFileId(cleanFileUrl);
      const data = await fetchFigmaFile(fileId, cleanApiKey);
      const variablesMeta = await fetchFigmaVariables(fileId, cleanApiKey);
      const extractedTokens = extractTokens(data, variablesMeta);
      setFigmaFileId(fileId);
      setTokens({
        ...extractedTokens,
        fileInfo: {
          name: data.name,
          lastModified: data.lastModified,
          thumbnailUrl: data.thumbnailUrl
        }
      });

      try {
        if (extractedTokens.components.length > 0) {
          const ids = extractedTokens.components.map(c => c.id).slice(0, 20);
          const images = await fetchFigmaImages(fileId, ids, cleanApiKey);
          setComponentImages(images);
        }
      } catch (imgErr) {
        console.warn('Image fetch failed but tokens are loaded', imgErr);
      }
    } catch (err) {
      const status = err.response?.status;
      const figmaMsg = err.response?.data?.message || err.message;
      setError(`Figma API Error (${status || 'Network'}): ${figmaMsg}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const startDemo = () => {
    setLoading(true);
    setFigmaFileId('');
    setPushMsg(null);
    setTimeout(() => {
      setTokens(MOCK_TOKENS);
      setLoading(false);
    }, 1500);
  };

  const handlePushToFigma = async () => {
    if (!apiKey.trim() || !figmaFileId) {
      setPushMsg({
        type: 'error',
        text: 'Push needs a real connected file. Generate from a Figma URL + token first (not available in demo mode).'
      });
      return;
    }
    setPushing(true);
    setPushMsg(null);
    try {
      const { count } = await pushTokensToFigma(figmaFileId, apiKey.trim(), tokens);
      setPushMsg({ type: 'success', text: `Pushed ${count} variables to Figma. Open the file's Variables panel to see them.` });
    } catch (err) {
      const status = err.response?.status;
      const figmaMsg = err.response?.data?.message || err.message;
      setPushMsg({
        type: 'error',
        text: `Figma write failed (${status || 'Network'}): ${figmaMsg}${status === 403 ? ' — the Variables write API requires an Enterprise org and a token with file_variables:write scope.' : ''}`
      });
    } finally {
      setPushing(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadMarkdown = () => {
    let content = `# Design System: ${tokens.fileInfo.name}\n\n`;
    content += `Generated by FigmaTokens Pro - Sangar Studio\n\n`;
    content += `## Colors\n\n`;
    tokens.colors.forEach(c => content += `- **${c.name}**: ${c.hex} (RGB ${c.r}, ${c.g}, ${c.b})\n`);
    content += `\n## Typography\n\n`;
    tokens.typography.forEach(t => content += `- **${t.name}**: ${t.fontSize}px ${t.fontFamily} (Weight ${t.fontWeight})\n`);
    content += `\n## Components\n\n`;
    tokens.components.forEach(c => content += `- ${c.name} (${c.type})\n`);

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'design.md';
    a.click();
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text(`Design System: ${tokens.fileInfo.name}`, 10, 20);
    doc.setFontSize(12);
    doc.text(`Author: Sangar Studio (https://sangar.studio)`, 10, 30);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 10, 35);
    let y = 50;
    doc.setFontSize(16);
    doc.text("Color Palette", 10, y);
    y += 10;
    doc.setFontSize(10);
    tokens.colors.forEach((c) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(`${c.name}: ${c.hex}`, 15, y);
      y += 7;
    });
    doc.save('design.pdf');
  };

  const filteredItems = useMemo(() => {
    if (!tokens) return null;
    const query = searchQuery.toLowerCase();
    return {
      colors: tokens.colors.filter(c => c.name.toLowerCase().includes(query)),
      typography: tokens.typography.filter(t => t.name.toLowerCase().includes(query)),
      components: tokens.components.filter(c => c.name.toLowerCase().includes(query))
    };
  }, [tokens, searchQuery]);

  if (route === '/privacy' || route === '/legal') {
    return <LegalPage type={route === '/privacy' ? 'privacy' : 'legal'} onNavigate={navigate} />;
  }

  if (!tokens) {
    return (
      <div className="landing-page">
        <header className="landing-header">
          <div className="logo">
            <Sparkles className="icon-glow" color="var(--accent-primary)" size={32} />
            <span>FigmaTokens Pro</span>
          </div>
          <div className="header-links">
            <button className="btn-link" onClick={startDemo}>View Demo</button>
            <GitPullRequest size={20} className="text-dim hover:text-white cursor-pointer" />
          </div>
        </header>

        <main className="landing-hero">
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="hero-content"
          >
            <div className="badge-new">By Sangar Studio</div>
            <h1 className="gradient-title">Bridge the gap between <br/> Design & Code.</h1>
            <p className="hero-subtitle">
              The world's fastest way to extract design tokens from Figma. 
              Get production-ready CSS, JSON, and documentation in seconds.
            </p>

            <div className="setup-box card-premium animate-in">
              <form onSubmit={handleGenerate} className="setup-form">
                <div className="form-row">
                  <div className="input-wrap">
                    <label>Figma Personal Token</label>
                    <input 
                      type="password" 
                      placeholder="figd_..." 
                      className="input-premium"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                  </div>
                  <div className="input-wrap">
                    <label>File URL</label>
                    <input 
                      type="text" 
                      placeholder="figma.com/file/..." 
                      className="input-premium"
                      value={fileUrl}
                      onChange={(e) => setFileUrl(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-footer">
                  <button type="submit" className="btn-premium primary" disabled={loading || !apiKey || !fileUrl}>
                    {loading ? <Loader2 className="animate-spin" /> : <><Zap size={18} /> Generate System</>}
                  </button>
                  <div className="divider">or</div>
                  <button type="button" className="btn-premium" onClick={startDemo}>
                    Try with Demo Data
                  </button>
                </div>
                {error && <p className="error-text">{error}</p>}
              </form>
            </div>
          </motion.div>
        </main>

        <footer className="landing-footer">
          <span>© {new Date().getFullYear()} Sangar Studio</span>
          <nav className="footer-links">
            <a href="/privacy" onClick={(e) => { e.preventDefault(); navigate('/privacy'); }}>Política de privacidad</a>
            <span className="footer-sep">·</span>
            <a href="/legal" onClick={(e) => { e.preventDefault(); navigate('/legal'); }}>Aviso legal</a>
          </nav>
        </footer>

        <style>{`
          .landing-page {
            height: 100vh; background: var(--bg-app); overflow-y: auto; display: flex; flex-direction: column;
            background-image: radial-gradient(circle at 50% -20%, rgba(167, 139, 250, 0.15) 0%, transparent 50%), url("https://www.transparenttextures.com/patterns/carbon-fibre.png");
          }
          .landing-header { display: flex; justify-content: space-between; align-items: center; padding: 2rem 4rem; }
          .logo { display: flex; align-items: center; gap: 1rem; font-family: var(--font-display); font-weight: 800; font-size: 1.5rem; }
          .icon-glow { filter: drop-shadow(0 0 8px var(--accent-glow)); }
          .landing-hero { flex: 1; display: flex; align-items: center; justify-content: center; padding: 4rem; }
          .hero-content { max-width: 900px; text-align: center; }
          .badge-new { display: inline-block; background: rgba(167, 139, 250, 0.1); color: var(--accent-primary); padding: 0.4rem 1rem; border-radius: 100px; font-size: 0.8rem; font-weight: 600; margin-bottom: 2rem; border: 1px solid rgba(167, 139, 250, 0.2); }
          .gradient-title { background: linear-gradient(to bottom, #fff, #999); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 2rem; }
          .hero-subtitle { font-size: 1.25rem; max-width: 600px; margin: 0 auto 3rem; }
          .setup-box { background: rgba(15, 15, 18, 0.8); backdrop-filter: blur(20px); padding: 3rem; text-align: left; border: 1px solid var(--bg-border); }
          .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem; }
          .input-wrap label { display: block; font-size: 0.85rem; color: var(--text-dim); margin-bottom: 0.75rem; font-weight: 500; }
          .form-footer { display: flex; align-items: center; gap: 1.5rem; }
          .divider { color: var(--text-dim); font-size: 0.9rem; }
          .error-text { color: var(--error); margin-top: 1.5rem; font-size: 0.9rem; }
          .btn-link { color: var(--text-secondary); font-weight: 500; transition: color 0.2s; }
          .btn-link:hover { color: white; }
          .landing-footer { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; padding: 1.5rem 4rem; border-top: 1px solid var(--bg-border); color: var(--text-dim); font-size: 0.85rem; }
          .footer-links { display: flex; align-items: center; gap: 0.75rem; }
          .footer-links a { color: var(--text-secondary); text-decoration: none; transition: color 0.2s; }
          .footer-links a:hover { color: white; }
          .footer-sep { color: var(--bg-border); }

          @media (max-width: 768px) {
            .landing-header { padding: 1.5rem 2rem; }
            .landing-hero { padding: 2rem; }
            .landing-footer { padding: 1.5rem 2rem; justify-content: center; text-align: center; }
            .form-row { grid-template-columns: 1fr; gap: 1rem; }
            .form-footer { flex-direction: column; width: 100%; }
            .form-footer button { width: 100%; }
            .divider { display: none; }
            .setup-box { padding: 2rem; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="app-container">
      <button className="mobile-menu-btn glass-effect" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
        {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <aside className={`app-sidebar glass-effect ${isSidebarOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-top">
          <div className="logo-small">
            <Sparkles size={24} color="var(--accent-primary)" />
            <span>FigmaTokens</span>
          </div>
          
          <nav className="side-nav">
            <NavItem active={activeTab === 'overview'} onClick={() => {setActiveTab('overview'); setIsSidebarOpen(false)}} icon={<Monitor size={18} />} label="Overview" />
            <NavItem active={activeTab === 'colors'} onClick={() => {setActiveTab('colors'); setIsSidebarOpen(false)}} icon={<Palette size={18} />} label="Colors" />
            <NavItem active={activeTab === 'typography'} onClick={() => {setActiveTab('typography'); setIsSidebarOpen(false)}} icon={<Type size={18} />} label="Typography" />
            <NavItem active={activeTab === 'components'} onClick={() => {setActiveTab('components'); setIsSidebarOpen(false)}} icon={<Layers size={18} />} label="Components" />
            <NavItem active={activeTab === 'export'} onClick={() => {setActiveTab('export'); setIsSidebarOpen(false)}} icon={<Download size={18} />} label="Export" />
          </nav>
        </div>

        <div className="sidebar-bottom">
          <a href="https://sangar.studio" target="_blank" rel="noreferrer" className="author-link">
            <Globe size={14} /> <span>By Sangar Studio</span> <ExternalLink size={10} />
          </a>
          <div className="file-info-mini">
            <img src={tokens.fileInfo.thumbnailUrl} alt="File Thumb" className="thumb" />
            <div className="info">
              <span className="file-name">{tokens.fileInfo.name}</span>
              <span className="file-date">Last synced {new Date(tokens.fileInfo.lastModified).toLocaleDateString()}</span>
            </div>
          </div>
          <button className="btn-logout" onClick={() => { setTokens(null); setFigmaFileId(''); setPushMsg(null); }}>
            <Settings size={16} /> Change File
          </button>
        </div>
      </aside>

      <main className="app-content">
        <header className="content-nav">
          <div className="search-bar">
            <Search size={18} className="text-dim" />
            <input type="text" placeholder="Search tokens..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            <div className="kbd hidden-mobile"><Command size={10} /> K</div>
          </div>
          <div className="nav-actions hidden-mobile">
            <div className="user-badge">
              <div className="avatar">JD</div>
              <span>Admin</span>
            </div>
          </div>
        </header>

        <div className="scroll-area">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}
              className="view-container"
            >
              {activeTab === 'overview' && (
                <div className="overview-grid">
                  <div className="hero-banner card-premium">
                    <div className="banner-text">
                      <h1>Welcome!</h1>
                      <p>Detected {tokens.colors.length + tokens.typography.length + tokens.components.length} tokens.</p>
                      <button className="btn-premium primary" onClick={() => setActiveTab('export')}>Generate Code</button>
                    </div>
                    <div className="banner-illus hidden-mobile">
                      <Zap size={100} color="var(--accent-primary)" strokeWidth={0.5} />
                    </div>
                  </div>
                  <div className="stat-cards">
                    <StatCard icon={<Palette size={20} />} label="Colors" count={tokens.colors.length} color="#A78BFA" />
                    <StatCard icon={<Type size={20} />} label="Typography" count={tokens.typography.length} color="#22D3EE" />
                    <StatCard icon={<Layers size={20} />} label="Components" count={tokens.components.length} color="#34D399" />
                  </div>
                </div>
              )}

              {activeTab === 'colors' && (
                <div className="token-view">
                  <div className="view-header"><h2>Colors</h2></div>
                  <div className="token-grid">{filteredItems.colors.map((color, i) => <ColorToken key={i} color={color} onCopy={copyToClipboard} />)}</div>
                </div>
              )}

              {activeTab === 'typography' && (
                <div className="token-view">
                  <div className="view-header"><h2>Typography</h2></div>
                  <div className="typo-list-premium">{filteredItems.typography.map((typo, i) => <TypoToken key={i} typo={typo} />)}</div>
                </div>
              )}

              {activeTab === 'components' && (
                <div className="token-view">
                  <div className="view-header"><h2>Components</h2></div>
                  <div className="comp-grid-premium">{filteredItems.components.map((comp, i) => <CompToken key={i} comp={comp} imageUrl={componentImages[comp.id]} />)}</div>
                </div>
              )}

              {activeTab === 'export' && (
                <div className="export-view">
                  <div className="view-header-row">
                    <h2>Export</h2>
                    <div className="export-btns">
                      <button className="btn-premium primary" onClick={handlePushToFigma} disabled={pushing}>
                        {pushing ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                        {pushing ? 'Pushing…' : 'Push to Figma'}
                      </button>
                      <button className="btn-premium" onClick={downloadMarkdown}><FileText size={16} /> .MD</button>
                      <button className="btn-premium" onClick={downloadPDF}><FileCode size={16} /> .PDF</button>
                    </div>
                  </div>
                  {pushMsg && (
                    <p className={pushMsg.type === 'success' ? 'push-msg-ok' : 'error-text'} style={{ marginBottom: '1.5rem' }}>
                      {pushMsg.text}
                    </p>
                  )}
                  <div className="export-options">
                    <ExportCard title="CSS" lang="css" code={`:root {\n${tokens.colors.map(c => `  --color-${c.name.toLowerCase().replace(/\s+/g, '-')}: ${c.hex};`).join('\n')}\n}`} onCopy={copyToClipboard} copied={copied} />
                    <ExportCard title="JSON" lang="json" code={JSON.stringify(tokens, null, 2)} onCopy={copyToClipboard} copied={copied} />
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <style>{`
        .app-sidebar { width: 280px; display: flex; flex-direction: column; padding: 2rem 1.5rem; border-right: 1px solid var(--bg-border); justify-content: space-between; transition: transform 0.3s ease; }
        .mobile-menu-btn { display: none; position: fixed; top: 1.25rem; left: 1.25rem; z-index: 100; padding: 0.5rem; border-radius: 8px; color: white; }
        .logo-small { display: flex; align-items: center; gap: 0.75rem; font-family: var(--font-display); font-weight: 800; font-size: 1.25rem; margin-bottom: 3rem; }
        .side-nav { display: flex; flex-direction: column; gap: 0.5rem; }
        .nav-item-btn { display: flex; align-items: center; gap: 1rem; padding: 0.85rem 1rem; border-radius: var(--radius-md); color: var(--text-secondary); font-weight: 500; width: 100%; transition: 0.2s; }
        .nav-item-btn:hover { background: rgba(255,255,255,0.05); color: white; }
        .nav-item-btn.active { background: rgba(167, 139, 250, 0.1); color: var(--accent-primary); border: 1px solid rgba(167, 139, 250, 0.1); }
        .author-link { display: flex; align-items: center; gap: 0.5rem; color: var(--accent-secondary); font-size: 0.75rem; font-weight: 600; margin-bottom: 1.5rem; text-decoration: none; }
        .file-info-mini { display: flex; align-items: center; gap: 1rem; padding: 1rem; background: var(--bg-surface); border-radius: var(--radius-md); margin-bottom: 1rem; border: 1px solid var(--bg-border); width: 100%; overflow: hidden; }
        .file-info-mini .thumb { width: 32px; height: 32px; border-radius: 6px; object-fit: cover; flex-shrink: 0; }
        .file-info-mini .info { display: flex; flex-direction: column; overflow: hidden; width: 100%; }
        .file-name { font-size: 0.85rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .app-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .content-nav { height: 80px; border-bottom: 1px solid var(--bg-border); display: flex; align-items: center; justify-content: space-between; padding: 0 4rem; }
        .search-bar { display: flex; align-items: center; gap: 1rem; background: var(--bg-surface); border: 1px solid var(--bg-border); padding: 0.6rem 1.25rem; border-radius: 100px; width: 400px; }
        .search-bar input { background: none; border: none; color: white; flex: 1; outline: none; font-size: 0.9rem; }
        .kbd { background: var(--bg-border); padding: 0.2rem 0.4rem; border-radius: 4px; color: var(--text-dim); font-size: 0.7rem; display: flex; align-items: center; gap: 2px; }
        .user-badge { display: flex; align-items: center; gap: 0.75rem; font-weight: 500; font-size: 0.9rem; }
        .avatar { width: 32px; height: 32px; background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #000; font-weight: 700; font-size: 0.7rem; }
        .scroll-area { flex: 1; overflow-y: auto; padding: 4rem; }
        .view-container { max-width: 1200px; margin: 0 auto; }
        .overview-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 2rem; }
        .hero-banner { grid-column: span 2; display: flex; align-items: center; justify-content: space-between; padding: 3rem; background: linear-gradient(135deg, rgba(167, 139, 250, 0.1), transparent); border: 1px solid rgba(167, 139, 250, 0.2); }
        .stat-cards { grid-column: 1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
        .stat-card { background: var(--bg-surface); border: 1px solid var(--bg-border); border-radius: var(--radius-lg); padding: 1.5rem; }
        .stat-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 1.25rem; }
        .token-view { display: flex; flex-direction: column; gap: 2rem; }
        .token-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.5rem; }
        .color-token-card { padding: 0; overflow: hidden; }
        .color-well { height: 140px; position: relative; }
        .color-copy-btn { position: absolute; top: 1rem; right: 1rem; opacity: 0; transition: 0.2s; }
        .color-well:hover .color-copy-btn { opacity: 1; }
        .color-details { padding: 1.25rem; }
        .typo-row { padding: 1.5rem 2rem; display: flex; align-items: center; gap: 3rem; }
        .typo-meta-box { width: 250px; }
        .typo-prev { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .comp-grid-premium { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 2rem; }
        .export-options { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
        .export-options > * { min-width: 0; }
        .code-container { background: #000; padding: 2rem; border-radius: var(--radius-md); height: 350px; overflow: auto; font-family: var(--font-mono); font-size: 0.85rem; color: #a5d6ff; line-height: 1.5; border: 1px solid var(--bg-border); max-width: 100%; }
        .code-container pre { margin: 0; }
        .view-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
        .export-btns { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .error-text { color: var(--error); font-size: 0.9rem; line-height: 1.5; }
        .push-msg-ok { color: var(--success); font-size: 0.9rem; line-height: 1.5; }

        @media (max-width: 1024px) {
          .overview-grid { grid-template-columns: 1fr; }
          .hero-banner { grid-column: span 1; }
          .stat-cards { grid-column: span 1; }
          .export-options { grid-template-columns: 1fr; }
        }

        @media (max-width: 768px) {
          .mobile-menu-btn { display: block; }
          .app-sidebar { position: fixed; left: 0; top: 0; bottom: 0; z-index: 99; transform: translateX(-100%); width: 280px; overflow-y: auto; }
          .app-sidebar.mobile-open { transform: translateX(0); }
          .content-nav { padding: 0 1.5rem; justify-content: flex-end; }
          .search-bar { width: 100%; max-width: none; margin-left: 3rem; }
          .hidden-mobile { display: none; }
          .scroll-area { padding: 1.5rem; }
          .stat-cards { grid-template-columns: 1fr; }
          .typo-row { flex-direction: column; align-items: flex-start; gap: 1rem; }
          .typo-meta-box { width: 100%; }
          .view-header-row { flex-direction: column; align-items: flex-start; gap: 1rem; }
          .export-btns { width: 100%; }
          .export-btns .btn-premium { flex: 1; justify-content: center; }
          .hero-banner { padding: 2rem; }
        }
      `}</style>
    </div>
  );
};

const NavItem = ({ active, onClick, icon, label }) => (
  <button className={`nav-item-btn ${active ? 'active' : ''}`} onClick={onClick}>
    {icon} <span>{label}</span>
  </button>
);

const StatCard = ({ icon, label, count, color }) => (
  <div className="stat-card">
    <div className="stat-icon" style={{ background: `${color}15`, color }}>{icon}</div>
    <span className="stat-label">{label}</span>
    <span className="stat-count">{count}</span>
  </div>
);

const ColorToken = ({ color, onCopy }) => (
  <div className="color-token-card card-premium">
    <div className="color-well" style={{ background: color.hex }} onClick={() => onCopy(color.hex)}>
      <div className="color-copy-btn btn-premium glass-effect"><Copy size={12} /></div>
    </div>
    <div className="color-details">
      <div className="color-meta flex justify-between">
        <span className="color-name">{color.name}</span>
        <code className="color-hex">{color.hex}</code>
      </div>
    </div>
  </div>
);

const TypoToken = ({ typo }) => (
  <div className="typo-row card-premium">
    <div className="typo-meta-box">
      <span className="name" style={{ color: 'var(--accent-secondary)', fontWeight: 700 }}>{typo.name}</span>
      <div className="stats" style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{typo.fontFamily} • {typo.fontSize}px</div>
    </div>
    <div className="typo-prev" style={{ fontFamily: typo.fontFamily, fontSize: Math.min(typo.fontSize, 32), fontWeight: typo.fontWeight }}>
      The quick brown fox jumps over the lazy dog.
    </div>
  </div>
);

const CompToken = ({ comp, imageUrl }) => (
  <div className="comp-card-premium card-premium">
    <div className="comp-hero" style={{ height: 180, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      {imageUrl ? <img src={imageUrl} alt={comp.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <Box size={48} color="var(--text-dim)" />}
    </div>
    <div className="comp-body" style={{ padding: '1.25rem' }}>
      <h3 style={{ fontSize: '1.1rem' }}>{comp.name}</h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>{comp.type}</p>
    </div>
  </div>
);

const ExportCard = ({ title, lang, code, onCopy, copied }) => (
  <div className="export-card-wrap card-premium">
    <div className="flex justify-between items-center mb-4">
      <h3>{title}</h3>
      <div className="badge-new" style={{ fontSize: '0.7rem' }}>{lang.toUpperCase()}</div>
    </div>
    <div className="code-container"><pre><code>{code}</code></pre></div>
    <button className="btn-premium primary" onClick={() => onCopy(code)} style={{ width: '100%', marginTop: '1rem' }}>
      {copied ? <><Check size={18} /> Copied!</> : <><Copy size={18} /> Copy {lang.toUpperCase()}</>}
    </button>
  </div>
);

const LEGAL_CONTENT = {
  privacy: {
    icon: <Shield size={26} color="var(--accent-primary)" />,
    title: 'Política de privacidad',
    updated: 'Última actualización: ' + new Date().toLocaleDateString('es-ES'),
    sections: [
      {
        h: '1. Resumen',
        p: 'FigmaTokens Pro se ejecuta íntegramente en tu navegador. No disponemos de servidores propios que reciban o almacenen los datos que introduces.'
      },
      {
        h: '2. Datos que tratamos',
        p: 'El token personal de Figma y la URL del archivo que introduces se utilizan únicamente dentro de tu navegador para realizar llamadas directas a la API oficial de Figma. No se envían, registran ni almacenan en servidores de Sangar Studio, ni se guardan de forma persistente en tu dispositivo.'
      },
      {
        h: '3. Generación local',
        p: 'Los tokens extraídos y las exportaciones (CSS, JSON, Markdown y PDF) se generan localmente en tu dispositivo. La función "Push to Figma", si la usas, envía tus tokens a la API de Figma para crear Variables en tu propio archivo.'
      },
      {
        h: '4. Cookies y analítica',
        p: 'La aplicación no instala cookies ni utiliza herramientas de analítica o seguimiento.'
      },
      {
        h: '5. Terceros',
        p: 'Las peticiones se dirigen a api.figma.com (sujeto a la política de privacidad de Figma). Además se cargan tipografías desde Google Fonts y una textura desde transparenttextures.com.'
      },
      {
        h: '6. Contacto',
        p: 'Para ejercer tus derechos o realizar consultas sobre privacidad: [completar correo de contacto]. Esta es una política base que refleja la arquitectura actual de la aplicación; revísala con asesoría legal antes de su uso en producción.'
      }
    ]
  },
  legal: {
    icon: <Scale size={26} color="var(--accent-primary)" />,
    title: 'Aviso legal',
    updated: 'Última actualización: ' + new Date().toLocaleDateString('es-ES'),
    sections: [
      {
        h: '1. Titular',
        p: 'Este sitio es operado por Sangar Studio (https://sangar.studio). Datos identificativos: razón social [completar], NIF/CIF [completar], domicilio [completar], correo de contacto [completar].'
      },
      {
        h: '2. Objeto',
        p: 'FigmaTokens Pro es una herramienta que permite extraer design tokens (colores, tipografía y componentes) de archivos de Figma y exportarlos en distintos formatos.'
      },
      {
        h: '3. Propiedad intelectual',
        p: 'Las marcas, nombres comerciales y, en particular, "Figma", pertenecen a sus respectivos titulares. FigmaTokens Pro no está afiliado, asociado ni respaldado por Figma, Inc.'
      },
      {
        h: '4. Responsabilidad',
        p: 'El servicio se proporciona "tal cual", sin garantías de ningún tipo. El usuario es el único responsable de la custodia de su token personal de Figma y del uso que haga de sus archivos y de los resultados generados.'
      },
      {
        h: '5. Legislación aplicable',
        p: 'Las presentes condiciones se rigen por la legislación de [completar jurisdicción], sometiéndose las partes a los juzgados y tribunales que correspondan.'
      }
    ]
  }
};

const LegalPage = ({ type, onNavigate }) => {
  const content = LEGAL_CONTENT[type];
  return (
    <div className="legal-page">
      <header className="legal-header">
        <button className="legal-back" onClick={() => onNavigate('/')}>
          <ArrowLeft size={18} /> Volver
        </button>
        <div className="logo-small">
          <Sparkles size={20} color="var(--accent-primary)" />
          <span>FigmaTokens Pro</span>
        </div>
      </header>

      <main className="legal-main">
        <div className="legal-title">
          {content.icon}
          <h1>{content.title}</h1>
        </div>
        <p className="legal-updated">{content.updated}</p>

        {content.sections.map((s) => (
          <section key={s.h} className="legal-section">
            <h2>{s.h}</h2>
            <p>{s.p}</p>
          </section>
        ))}

        <nav className="legal-cross">
          <a
            href={type === 'privacy' ? '/legal' : '/privacy'}
            onClick={(e) => { e.preventDefault(); onNavigate(type === 'privacy' ? '/legal' : '/privacy'); }}
          >
            {type === 'privacy' ? 'Ver aviso legal' : 'Ver política de privacidad'}
          </a>
        </nav>
      </main>

      <style>{`
        .legal-page { min-height: 100vh; height: 100vh; overflow-y: auto; background: var(--bg-app); display: flex; flex-direction: column;
          background-image: radial-gradient(circle at 50% -20%, rgba(167, 139, 250, 0.12) 0%, transparent 50%); }
        .legal-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.5rem 4rem; border-bottom: 1px solid var(--bg-border); }
        .legal-back { display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-weight: 600; transition: color 0.2s; }
        .legal-back:hover { color: white; }
        .logo-small { display: flex; align-items: center; gap: 0.6rem; font-family: var(--font-display); font-weight: 800; font-size: 1.05rem; }
        .legal-main { flex: 1; width: 100%; max-width: 760px; margin: 0 auto; padding: 4rem; }
        .legal-title { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem; }
        .legal-title h1 { font-size: 2.5rem; }
        .legal-updated { color: var(--text-dim); font-size: 0.85rem; margin-bottom: 3rem; }
        .legal-section { margin-bottom: 2rem; }
        .legal-section h2 { font-size: 1.15rem; margin-bottom: 0.6rem; color: var(--text-primary); }
        .legal-section p { color: var(--text-secondary); line-height: 1.7; }
        .legal-cross { margin-top: 3rem; padding-top: 2rem; border-top: 1px solid var(--bg-border); }
        .legal-cross a { color: var(--accent-secondary); font-weight: 600; text-decoration: none; }
        .legal-cross a:hover { text-decoration: underline; }

        @media (max-width: 768px) {
          .legal-header { padding: 1.25rem 1.5rem; }
          .legal-main { padding: 2.5rem 1.5rem; }
          .legal-title h1 { font-size: 1.9rem; }
        }
      `}</style>
    </div>
  );
};

export default App;
