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
  Scale,
  Cookie
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import { fetchFigmaFile, extractTokens, fetchFigmaImages, fetchFigmaVariables, pushTokensToFigma, generateTokenStudioJSON, generateCSSTokens } from './services/figma';

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
    content += `Generated by FigmaTokens Pro — Sangar Studio\n\n`;
    content += `## Colors\n\n`;
    tokens.colors.forEach(c => content += `- **${c.name}**: \`${c.hex}\` (RGB ${c.r}, ${c.g}, ${c.b})${c.source === 'variable' ? ' · Variable' : c.source === 'style' ? ' · Style' : ''}\n`);
    content += `\n## Typography\n\n`;
    tokens.typography.forEach(t => content += `- **${t.name}**: ${t.fontSize}px ${t.fontFamily}, weight ${t.fontWeight}${t.lineHeight ? `, line-height ${Math.round(t.lineHeight)}px` : ''}\n`);
    if (tokens.spacing?.length) {
      content += `\n## Spacing\n\n`;
      tokens.spacing.forEach(s => content += `- **${s.name}**: ${s.value}px\n`);
    }
    content += `\n## Components\n\n`;
    tokens.components.forEach(c => content += `- ${c.name} (${c.type})\n`);

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tokens.fileInfo.name.replace(/\s+/g, '-').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadTokenStudio = () => {
    const json = generateTokenStudioJSON(tokens);
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tokens.fileInfo.name.replace(/\s+/g, '-').toLowerCase()}.tokens.json`;
    a.click();
    URL.revokeObjectURL(url);
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

  if (route === '/privacy' || route === '/legal' || route === '/cookies') {
    const type = route === '/privacy' ? 'privacy' : route === '/legal' ? 'legal' : 'cookies';
    return <LegalPage type={type} onNavigate={navigate} />;
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
          <span>© {new Date().getFullYear()} Jesús Sánchez García · Sangar Studio</span>
          <nav className="footer-links">
            <a href="/privacy" onClick={(e) => { e.preventDefault(); navigate('/privacy'); }}>Privacidad</a>
            <span className="footer-sep">·</span>
            <a href="/legal" onClick={(e) => { e.preventDefault(); navigate('/legal'); }}>Aviso legal</a>
            <span className="footer-sep">·</span>
            <a href="/cookies" onClick={(e) => { e.preventDefault(); navigate('/cookies'); }}>Cookies</a>
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

      {isSidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />
      )}

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
              {activeTab === 'overview' && (() => {
                const fromVar = tokens.colors.filter(c => c.source === 'variable').length + tokens.typography.filter(t => t.source === 'variable').length;
                const fromStyle = tokens.colors.filter(c => c.source === 'style').length + tokens.typography.filter(t => t.source === 'style').length;
                const fromRaw = tokens.colors.filter(c => !c.source || c.source === 'fill').length + tokens.typography.filter(t => !t.source || t.source === 'fill').length;
                const total = tokens.colors.length + tokens.typography.length + tokens.components.length + (tokens.spacing?.length || 0);
                return (
                  <div className="overview-grid">
                    <div className="hero-banner card-premium">
                      <div className="banner-text">
                        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{tokens.fileInfo.name}</h1>
                        <p style={{ marginBottom: '1.5rem' }}>{total} tokens detectados</p>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                          {fromVar > 0 && <span className="source-badge source-variable">{fromVar} Variables</span>}
                          {fromStyle > 0 && <span className="source-badge source-style">{fromStyle} Styles</span>}
                          {fromRaw > 0 && <span className="source-badge source-raw">{fromRaw} Raw fills</span>}
                        </div>
                        <button className="btn-premium primary" onClick={() => setActiveTab('export')}>Exportar</button>
                      </div>
                      <div className="banner-illus hidden-mobile">
                        <Zap size={90} color="var(--accent-primary)" strokeWidth={0.5} />
                      </div>
                    </div>
                    <div className="stat-cards">
                      <StatCard icon={<Palette size={20} />} label="Colors" count={tokens.colors.length} color="#A78BFA" />
                      <StatCard icon={<Type size={20} />} label="Typography" count={tokens.typography.length} color="#22D3EE" />
                      <StatCard icon={<Layers size={20} />} label="Components" count={tokens.components.length} color="#34D399" />
                    </div>
                    {fromRaw > 0 && fromVar === 0 && fromStyle === 0 && (
                      <div style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        <strong style={{ color: 'var(--warning)' }}>Tokens extraídos de rellenos raw.</strong> Para mayor precisión, define <strong>Styles</strong> o <strong>Variables</strong> en tu archivo de Figma y vuelve a generar.
                      </div>
                    )}
                  </div>
                );
              })()}

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
                      <button className="btn-premium" onClick={downloadMarkdown}><FileText size={16} /> .MD</button>
                      <button className="btn-premium" onClick={downloadPDF}><FileCode size={16} /> .PDF</button>
                      <button className="btn-premium" onClick={downloadTokenStudio} title="Import into Figma via the Token Studio plugin (free)">
                        <Download size={16} /> Token Studio
                      </button>
                    </div>
                  </div>

                  <div className="push-section">
                    <div className="push-section-header">
                      <div>
                        <h3 style={{ marginBottom: '0.25rem' }}>Push to Figma Variables</h3>
                        <p style={{ fontSize: '0.85rem', margin: 0 }}>
                          Writes tokens directly as Figma Variables.{' '}
                          <span style={{ color: 'var(--warning)' }}>Requires Enterprise plan + <code>file_variables:write</code> scope.</span>
                        </p>
                      </div>
                      <button
                        className={`btn-premium primary${!figmaFileId ? ' btn-disabled' : ''}`}
                        onClick={handlePushToFigma}
                        disabled={pushing || !figmaFileId}
                        title={!figmaFileId ? 'Connect a real Figma file to enable push (not available in demo)' : ''}
                      >
                        {pushing ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                        {pushing ? 'Pushing…' : 'Push to Figma'}
                      </button>
                    </div>
                    {!figmaFileId && (
                      <p className="demo-notice">Demo mode — connect a real Figma file to push variables.</p>
                    )}
                    {pushMsg && (
                      <p className={pushMsg.type === 'success' ? 'push-msg-ok' : 'error-text'} style={{ marginTop: '0.75rem' }}>
                        {pushMsg.text}
                      </p>
                    )}
                  </div>

                  <div className="export-options">
                    <ExportCard title="CSS Variables" lang="css" code={generateCSSTokens(tokens)} onCopy={copyToClipboard} copied={copied} />
                    <ExportCard title="JSON (raw)" lang="json" code={JSON.stringify({ colors: tokens.colors, typography: tokens.typography, spacing: tokens.spacing }, null, 2)} onCopy={copyToClipboard} copied={copied} />
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <style>{`
        /* ── Layout ─────────────────────────────────── */
        .app-sidebar { width: 280px; flex-shrink: 0; display: flex; flex-direction: column; padding: 2rem 1.5rem; border-right: 1px solid var(--bg-border); justify-content: space-between; transition: transform 0.3s ease; }
        .sidebar-backdrop { display: none; }
        .mobile-menu-btn { display: none; position: fixed; top: 1.25rem; left: 1.25rem; z-index: 101; padding: 0.5rem; border-radius: 8px; color: white; }
        .logo-small { display: flex; align-items: center; gap: 0.75rem; font-family: var(--font-display); font-weight: 800; font-size: 1.25rem; margin-bottom: 3rem; }
        .side-nav { display: flex; flex-direction: column; gap: 0.5rem; }

        /* ── Sidebar nav items ───────────────────────── */
        .nav-item-btn { display: flex; align-items: center; gap: 1rem; padding: 0.85rem 1rem; border-radius: var(--radius-md); color: var(--text-secondary); font-weight: 500; width: 100%; transition: 0.2s; }
        .nav-item-btn:hover { background: rgba(255,255,255,0.05); color: white; }
        .nav-item-btn.active { background: rgba(167, 139, 250, 0.1); color: var(--accent-primary); border: 1px solid rgba(167, 139, 250, 0.1); }

        /* ── Sidebar bottom ──────────────────────────── */
        .author-link { display: flex; align-items: center; gap: 0.5rem; color: var(--accent-secondary); font-size: 0.75rem; font-weight: 600; margin-bottom: 1.5rem; text-decoration: none; }
        .file-info-mini { display: flex; align-items: center; gap: 1rem; padding: 1rem; background: var(--bg-surface); border-radius: var(--radius-md); margin-bottom: 1rem; border: 1px solid var(--bg-border); width: 100%; overflow: hidden; }
        .file-info-mini .thumb { width: 32px; height: 32px; border-radius: 6px; object-fit: cover; flex-shrink: 0; }
        .file-info-mini .info { display: flex; flex-direction: column; overflow: hidden; width: 100%; }
        .file-name { font-size: 0.85rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .file-date { font-size: 0.75rem; color: var(--text-dim); margin-top: 0.15rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .btn-logout { display: flex; align-items: center; gap: 0.75rem; width: 100%; padding: 0.75rem 1rem; border-radius: var(--radius-md); background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border); color: var(--text-secondary); font-weight: 500; font-size: 0.9rem; transition: 0.2s; }
        .btn-logout:hover { background: rgba(255,255,255,0.07); color: white; }

        /* ── Main content ────────────────────────────── */
        .app-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
        .content-nav { height: 80px; border-bottom: 1px solid var(--bg-border); display: flex; align-items: center; justify-content: space-between; padding: 0 2.5rem; gap: 1rem; }
        .search-bar { display: flex; align-items: center; gap: 1rem; background: var(--bg-surface); border: 1px solid var(--bg-border); padding: 0.6rem 1.25rem; border-radius: 100px; width: 360px; min-width: 0; }
        .search-bar input { background: none; border: none; color: white; flex: 1; outline: none; font-size: 0.9rem; min-width: 0; }
        .kbd { background: var(--bg-border); padding: 0.2rem 0.4rem; border-radius: 4px; color: var(--text-dim); font-size: 0.7rem; display: flex; align-items: center; gap: 2px; white-space: nowrap; }
        .user-badge { display: flex; align-items: center; gap: 0.75rem; font-weight: 500; font-size: 0.9rem; white-space: nowrap; }
        .avatar { width: 32px; height: 32px; background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #000; font-weight: 700; font-size: 0.7rem; flex-shrink: 0; }
        .scroll-area { flex: 1; overflow-y: auto; padding: 2.5rem; }
        .view-container { max-width: 1200px; margin: 0 auto; }

        /* ── Overview ────────────────────────────────── */
        .overview-grid { display: grid; grid-template-columns: 1fr; gap: 2rem; }
        .hero-banner { display: flex; align-items: center; justify-content: space-between; padding: 3rem; background: linear-gradient(135deg, rgba(167, 139, 250, 0.1), transparent); border: 1px solid rgba(167, 139, 250, 0.2); border-radius: var(--radius-lg); }
        .stat-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
        .stat-card { background: var(--bg-surface); border: 1px solid var(--bg-border); border-radius: var(--radius-lg); padding: 1.5rem; display: flex; flex-direction: column; }
        .stat-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 1.25rem; flex-shrink: 0; }
        .stat-label { font-size: 0.85rem; color: var(--text-dim); font-weight: 500; margin-bottom: 0.25rem; }
        .stat-count { font-family: var(--font-display); font-size: 2rem; font-weight: 800; color: var(--text-primary); line-height: 1; }

        /* ── Token views ─────────────────────────────── */
        .token-view { display: flex; flex-direction: column; gap: 2rem; }
        .view-header { display: flex; align-items: center; justify-content: space-between; }
        .token-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1.5rem; }
        .color-token-card { padding: 0; overflow: hidden; }
        .color-well { height: 140px; position: relative; cursor: pointer; }
        .color-copy-btn { position: absolute; top: 1rem; right: 1rem; opacity: 0; transition: 0.2s; }
        .color-well:hover .color-copy-btn { opacity: 1; }
        .color-details { padding: 1.25rem; display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; }
        .color-meta { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }
        .color-name { font-size: 0.85rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .color-hex { font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-dim); background: rgba(255,255,255,0.05); padding: 0.15rem 0.4rem; border-radius: 4px; }

        /* ── Typography ──────────────────────────────── */
        .typo-list-premium { display: flex; flex-direction: column; gap: 1rem; }
        .typo-row { padding: 1.25rem 1.75rem; display: flex; align-items: center; gap: 2rem; }
        .typo-meta-box { width: 220px; flex-shrink: 0; }
        .typo-prev { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }

        /* ── Components ──────────────────────────────── */
        .comp-grid-premium { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 2rem; }

        /* ── Source badges ───────────────────────────── */
        .source-badge { display: inline-flex; align-items: center; padding: 0.15rem 0.5rem; border-radius: 100px; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; white-space: nowrap; }
        .source-variable { background: rgba(167, 139, 250, 0.15); color: var(--accent-primary); }
        .source-style { background: rgba(34, 211, 238, 0.15); color: var(--accent-secondary); }
        .source-raw { background: rgba(251, 191, 36, 0.12); color: var(--warning); }

        /* ── Export ──────────────────────────────────── */
        .export-view { display: flex; flex-direction: column; gap: 2rem; }
        .view-header-row { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }
        .export-btns { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .push-section { background: var(--bg-surface); border: 1px solid var(--bg-border); border-radius: var(--radius-lg); padding: 1.5rem; }
        .push-section-header { display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; flex-wrap: wrap; }
        .demo-notice { font-size: 0.8rem; color: var(--text-dim); margin-top: 0.75rem; }
        .btn-disabled { opacity: 0.45; cursor: not-allowed; }
        .export-options { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
        .export-options > * { min-width: 0; }
        .export-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
        .code-container { background: #000; padding: 1.5rem; border-radius: var(--radius-md); height: 320px; overflow: auto; font-family: var(--font-mono); font-size: 0.8rem; color: #a5d6ff; line-height: 1.6; border: 1px solid var(--bg-border); }
        .code-container pre { margin: 0; white-space: pre; }
        .error-text { color: var(--error); font-size: 0.9rem; line-height: 1.5; }
        .push-msg-ok { color: var(--success); font-size: 0.9rem; line-height: 1.5; }

        /* ── Tablet (≤ 1024px) ───────────────────────── */
        @media (max-width: 1024px) {
          .scroll-area { padding: 2rem; }
          .content-nav { padding: 0 2rem; }
          .export-options { grid-template-columns: 1fr; }
          .hero-banner { padding: 2rem; }
        }

        /* ── Mobile (≤ 768px) ────────────────────────── */
        @media (max-width: 768px) {
          .mobile-menu-btn { display: flex; }
          .app-sidebar { position: fixed; left: 0; top: 0; bottom: 0; z-index: 100; transform: translateX(-100%); width: 280px; overflow-y: auto; }
          .app-sidebar.mobile-open { transform: translateX(0); box-shadow: 4px 0 40px rgba(0,0,0,0.6); }
          .sidebar-backdrop { display: block; position: fixed; inset: 0; z-index: 99; background: rgba(0,0,0,0.5); backdrop-filter: blur(2px); }
          .content-nav { padding: 0 1.25rem; justify-content: flex-end; }
          .search-bar { width: 100%; max-width: none; margin-left: 3rem; }
          .hidden-mobile { display: none !important; }
          .scroll-area { padding: 1.25rem; }
          .stat-cards { grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
          .stat-card { padding: 1rem; }
          .stat-count { font-size: 1.5rem; }
          .typo-row { flex-direction: column; align-items: flex-start; gap: 0.75rem; padding: 1rem 1.25rem; }
          .typo-meta-box { width: 100%; }
          .view-header-row { flex-direction: column; align-items: flex-start; }
          .export-btns { width: 100%; }
          .export-btns .btn-premium { flex: 1; justify-content: center; }
          .push-section-header { flex-direction: column; align-items: flex-start; }
          .push-section-header .btn-premium { width: 100%; justify-content: center; }
          .hero-banner { flex-direction: column; align-items: flex-start; gap: 1.5rem; padding: 1.5rem; }
          .comp-grid-premium { grid-template-columns: 1fr 1fr; }
        }

        @media (max-width: 480px) {
          .stat-cards { grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }
          .stat-label { font-size: 0.75rem; }
          .comp-grid-premium { grid-template-columns: 1fr; }
          .token-grid { grid-template-columns: 1fr 1fr; }
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

const SourceBadge = ({ source }) => {
  if (!source || source === 'fill') return <span className="source-badge source-raw">Raw</span>;
  if (source === 'variable') return <span className="source-badge source-variable">Variable</span>;
  if (source === 'style') return <span className="source-badge source-style">Style</span>;
  return null;
};

const ColorToken = ({ color, onCopy }) => (
  <div className="color-token-card card-premium">
    <div className="color-well" style={{ background: color.hex }} onClick={() => onCopy(color.hex)}>
      <div className="color-copy-btn btn-premium glass-effect"><Copy size={12} /></div>
    </div>
    <div className="color-details">
      <div className="color-meta">
        <span className="color-name">{color.name}</span>
        <code className="color-hex">{color.hex}</code>
      </div>
      {color.source && <SourceBadge source={color.source} />}
    </div>
  </div>
);

const TypoToken = ({ typo }) => (
  <div className="typo-row card-premium">
    <div className="typo-meta-box">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
        <span style={{ color: 'var(--accent-secondary)', fontWeight: 700, fontSize: '0.9rem' }}>{typo.name}</span>
        {typo.source && <SourceBadge source={typo.source} />}
      </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', lineHeight: 1.6 }}>
        {typo.fontFamily} · {typo.fontSize}px · w{typo.fontWeight}
        {typo.lineHeight ? ` · ${Math.round(typo.lineHeight)}px` : ''}
      </div>
    </div>
    <div className="typo-prev" style={{ fontFamily: typo.fontFamily, fontSize: Math.min(typo.fontSize, 28), fontWeight: typo.fontWeight }}>
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
    <div className="export-card-header">
      <h3 style={{ fontSize: '1rem' }}>{title}</h3>
      <div className="badge-new" style={{ fontSize: '0.65rem' }}>{lang.toUpperCase()}</div>
    </div>
    <div className="code-container"><pre><code>{code}</code></pre></div>
    <button className="btn-premium primary" onClick={() => onCopy(code)} style={{ width: '100%', marginTop: '1rem', justifyContent: 'center' }}>
      {copied ? <><Check size={16} /> Copiado</> : <><Copy size={16} /> Copiar {lang.toUpperCase()}</>}
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
        h: '2. Responsable del tratamiento',
        p: 'Jesús Sánchez García, autónomo, con NIF [NIF del titular], con domicilio en [dirección completa] y correo de contacto hola@sangar.studio.'
      },
      {
        h: '3. Datos que tratamos',
        p: 'El token personal de Figma y la URL del archivo que introduces se utilizan únicamente dentro de tu navegador para realizar llamadas directas a la API oficial de Figma. No se envían, registran ni almacenan en servidores de Sangar Studio, ni se guardan de forma persistente en tu dispositivo.'
      },
      {
        h: '4. Generación local',
        p: 'Los tokens extraídos y las exportaciones (CSS, JSON, Markdown y PDF) se generan localmente en tu dispositivo. La función "Push to Figma", si la usas, envía tus tokens a la API de Figma para crear Variables en tu propio archivo.'
      },
      {
        h: '5. Cookies y analítica',
        p: 'La aplicación no instala cookies propias ni utiliza herramientas de analítica o seguimiento. Consulta nuestra Política de cookies para más información.'
      },
      {
        h: '6. Terceros',
        p: 'Las peticiones se dirigen a api.figma.com (sujeto a la política de privacidad de Figma, Inc.). Además se cargan tipografías desde Google Fonts y una textura decorativa desde transparenttextures.com.'
      },
      {
        h: '7. Derechos',
        p: 'Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición y portabilidad escribiendo a hola@sangar.studio. En caso de disconformidad puedes presentar una reclamación ante la Agencia Española de Protección de Datos (aepd.es).'
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
        p: 'Este sitio web es titularidad de Jesús Sánchez García, autónomo, con NIF [NIF del titular], con domicilio a efectos de notificaciones en [dirección completa], y correo de contacto hola@sangar.studio. Sitio web: https://sangar.studio.'
      },
      {
        h: '2. Objeto',
        p: 'FigmaTokens Pro es una herramienta que permite extraer design tokens (colores, tipografía y componentes) de archivos de Figma y exportarlos en distintos formatos (CSS, JSON, Markdown y PDF).'
      },
      {
        h: '3. Propiedad intelectual',
        p: 'El código fuente, diseño y contenidos de FigmaTokens Pro son propiedad de Jesús Sánchez García. La marca "Figma" y sus APIs son propiedad de Figma, Inc. FigmaTokens Pro no está afiliado, asociado ni respaldado por Figma, Inc.'
      },
      {
        h: '4. Responsabilidad',
        p: 'El servicio se proporciona "tal cual", sin garantías de ningún tipo. El usuario es el único responsable de la custodia de su token personal de Figma y del uso que haga de sus archivos y de los resultados generados.'
      },
      {
        h: '5. Legislación aplicable',
        p: 'Las presentes condiciones se rigen por la legislación española, sometiéndose las partes a los juzgados y tribunales de [ciudad del domicilio del titular], con renuncia a cualquier otro fuero que pudiera corresponderles.'
      }
    ]
  },
  cookies: {
    icon: <Cookie size={26} color="var(--accent-primary)" />,
    title: 'Política de cookies',
    updated: 'Última actualización: ' + new Date().toLocaleDateString('es-ES'),
    sections: [
      {
        h: '1. ¿Qué son las cookies?',
        p: 'Las cookies son pequeños ficheros de texto que un sitio web almacena en el navegador del usuario cuando este lo visita. Sirven para recordar preferencias, identificar sesiones y, en algunos casos, rastrear el comportamiento del usuario con fines analíticos o publicitarios.'
      },
      {
        h: '2. ¿Usamos cookies?',
        p: 'FigmaTokens Pro no instala ninguna cookie propia de sesión, analítica ni publicitaria. La aplicación se ejecuta íntegramente en tu navegador y no almacena datos de forma persistente en tu dispositivo.'
      },
      {
        h: '3. Cookies de terceros',
        p: 'Al cargar tipografías desde Google Fonts, es posible que Google registre la solicitud HTTP en sus servidores (dirección IP, navegador y hora). Dicha petición no establece cookies identificativas en tu dispositivo. Consulta la política de privacidad de Google para más información.'
      },
      {
        h: '4. Almacenamiento local',
        p: 'La aplicación no utiliza localStorage ni sessionStorage para almacenar el token de Figma u otros datos sensibles entre sesiones. Los datos introducidos permanecen únicamente en memoria durante la sesión activa del navegador.'
      },
      {
        h: '5. Cambios en esta política',
        p: 'Si en el futuro incorporamos cookies o tecnologías de rastreo, actualizaremos esta página y, cuando sea legalmente exigible, solicitaremos tu consentimiento previo.'
      },
      {
        h: '6. Contacto',
        p: 'Para cualquier consulta sobre el uso de cookies puedes escribirnos a hola@sangar.studio.'
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
          {type !== 'privacy' && (
            <a href="/privacy" onClick={(e) => { e.preventDefault(); onNavigate('/privacy'); }}>Política de privacidad</a>
          )}
          {type !== 'legal' && (
            <a href="/legal" onClick={(e) => { e.preventDefault(); onNavigate('/legal'); }}>Aviso legal</a>
          )}
          {type !== 'cookies' && (
            <a href="/cookies" onClick={(e) => { e.preventDefault(); onNavigate('/cookies'); }}>Política de cookies</a>
          )}
        </nav>
      </main>

      <footer className="legal-footer">
        <span>© {new Date().getFullYear()} Jesús Sánchez García · Sangar Studio</span>
        <nav className="footer-links">
          <a href="/privacy" onClick={(e) => { e.preventDefault(); onNavigate('/privacy'); }}>Privacidad</a>
          <span className="footer-sep">·</span>
          <a href="/legal" onClick={(e) => { e.preventDefault(); onNavigate('/legal'); }}>Aviso legal</a>
          <span className="footer-sep">·</span>
          <a href="/cookies" onClick={(e) => { e.preventDefault(); onNavigate('/cookies'); }}>Cookies</a>
        </nav>
      </footer>

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
        .legal-cross { display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 3rem; padding-top: 2rem; border-top: 1px solid var(--bg-border); }
        .legal-cross a { color: var(--accent-secondary); font-weight: 600; text-decoration: none; }
        .legal-cross a:hover { text-decoration: underline; }
        .legal-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; padding: 1.5rem 4rem; border-top: 1px solid var(--bg-border); color: var(--text-dim); font-size: 0.85rem; }
        .footer-links { display: flex; align-items: center; gap: 0.75rem; }
        .footer-links a { color: var(--text-secondary); text-decoration: none; transition: color 0.2s; }
        .footer-links a:hover { color: white; }
        .footer-sep { color: var(--bg-border); }

        @media (max-width: 768px) {
          .legal-header { padding: 1.25rem 1.5rem; }
          .legal-main { padding: 2.5rem 1.5rem; }
          .legal-title h1 { font-size: 1.9rem; }
          .legal-footer { padding: 1.5rem; justify-content: center; text-align: center; }
        }
      `}</style>
    </div>
  );
};

export default App;
