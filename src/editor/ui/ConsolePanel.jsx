import React, { useState, useEffect, useRef } from 'react';
import './ConsolePanel.css';

/**
 * ConsolePanel - Painel de console para logs de scripts
 */
export default function ConsolePanel({ scriptConsole, isVisible }) {
  const [messages, setMessages] = useState([]);
  const [counts, setCounts] = useState({ log: 0, warn: 0, error: 0, info: 0 });
  const [filter, setFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);

  // Sincronizar com ScriptConsole
  useEffect(() => {
    if (!scriptConsole) return;

    // Carregar mensagens iniciais
    setMessages([...scriptConsole.messages]);
    setCounts({ ...scriptConsole.counts });

    // Listener para novas mensagens
    const unsubscribe = scriptConsole.addListener((message, allMessages, newCounts) => {
      if (message.type === 'clear') {
        setMessages([]);
        setCounts({ log: 0, warn: 0, error: 0, info: 0 });
      } else {
        setMessages([...allMessages]);
        setCounts({ ...newCounts });
      }
    });

    return unsubscribe;
  }, [scriptConsole]);

  // Auto-scroll quando novas mensagens chegam
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // Detectar scroll manual para pausar auto-scroll
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  // Filtrar mensagens
  const filteredMessages = messages.filter(msg => {
    // Filtro por tipo
    if (filter !== 'all' && msg.type !== filter) return false;

    // Filtro por texto
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      return (
        msg.content.toLowerCase().includes(searchLower) ||
        msg.source.toLowerCase().includes(searchLower)
      );
    }

    return true;
  });

  // Limpar console
  const handleClear = () => {
    if (scriptConsole) {
      scriptConsole.clear();
    }
  };

  // Ícone por tipo de mensagem
  const getIcon = (type) => {
    switch (type) {
      case 'error': return '✕';
      case 'warn': return '⚠';
      case 'info': return 'ℹ';
      default: return '›';
    }
  };

  if (!isVisible) return null;

  return (
    <div className="console-panel">
      {/* Toolbar */}
      <div className="console-toolbar">
        <button
          className="console-btn clear"
          onClick={handleClear}
          title="Clear console"
        >
          Clear
        </button>

        {/* Filtros */}
        <div className="console-filters">
          <button
            className={`console-filter ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({messages.length})
          </button>
          <button
            className={`console-filter log ${filter === 'log' ? 'active' : ''}`}
            onClick={() => setFilter('log')}
          >
            Log ({counts.log})
          </button>
          <button
            className={`console-filter warn ${filter === 'warn' ? 'active' : ''}`}
            onClick={() => setFilter('warn')}
          >
            Warn ({counts.warn})
          </button>
          <button
            className={`console-filter error ${filter === 'error' ? 'active' : ''}`}
            onClick={() => setFilter('error')}
          >
            Error ({counts.error})
          </button>
        </div>

        {/* Busca */}
        <input
          type="text"
          className="console-search"
          placeholder="Filter..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </div>

      {/* Mensagens */}
      <div
        className="console-messages"
        ref={containerRef}
        onScroll={handleScroll}
      >
        {filteredMessages.length === 0 ? (
          <div className="console-empty">
            {messages.length === 0
              ? 'No messages yet. Scripts will log here.'
              : 'No messages match the current filter.'}
          </div>
        ) : (
          filteredMessages.map((msg) => (
            <div key={msg.id} className={`console-message ${msg.type}`}>
              <span className="msg-icon">{getIcon(msg.type)}</span>
              <span className="msg-time">{msg.timestamp}</span>
              <span className="msg-source">[{msg.source}]</span>
              <span className="msg-content">{msg.content}</span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Status bar */}
      <div className="console-status">
        <span>{filteredMessages.length} messages</span>
        {!autoScroll && (
          <button
            className="console-btn scroll-bottom"
            onClick={() => {
              setAutoScroll(true);
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            ↓ Scroll to bottom
          </button>
        )}
      </div>
    </div>
  );
}
