(function () {
  const chat = document.getElementById("chat");
  const form = document.getElementById("form");
  const input = document.getElementById("input");
  const send = document.getElementById("send");

  const history = [];

  function renderMarkdown(text) {
    // Create a container for the rendered content
    const container = document.createElement("div");
    container.style.wordBreak = "break-word";
    
    // Split text into parts by detecting markdown tables
    const parts = [];
    const lines = text.split('\n');
    let currentText = [];
    let inTable = false;
    let tableLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Skip empty lines when in table mode (they don't break the table)
      if (inTable && !trimmed) {
        continue;
      }
      
      // Check if this line looks like a table row
      const isTableRow = trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2;
      // Check if this is a separator line
      const isSeparator = isTableRow && /^\|[\s\-:]+\|$/.test(trimmed) && trimmed.includes('-');
      
      if (isTableRow && !inTable) {
        // Starting a new table - save any accumulated text
        if (currentText.length > 0) {
          parts.push({ type: 'text', content: currentText.join('\n') });
          currentText = [];
        }
        inTable = true;
        tableLines = [trimmed];
      } else if (inTable) {
        if (isTableRow) {
          tableLines.push(trimmed);
        } else if (trimmed) {
          // End of table (non-empty non-table line) - parse it
          if (tableLines.length >= 2) {
            const tableContent = tableLines.join('\n');
            parts.push({ type: 'table', content: tableContent });
          } else {
            // Not a valid table, treat as text
            currentText.push(...tableLines);
          }
          tableLines = [];
          inTable = false;
          currentText.push(line);
        }
        // Empty lines in table mode are skipped (handled above)
      } else {
        currentText.push(line);
      }
    }
    
    // Handle remaining content
    if (inTable && tableLines.length >= 2) {
      parts.push({ type: 'table', content: tableLines.join('\n') });
    } else if (tableLines.length > 0) {
      currentText.push(...tableLines);
    }
    
    if (currentText.length > 0) {
      parts.push({ type: 'text', content: currentText.join('\n') });
    }
    
    // If no parts found, treat entire text as text
    if (parts.length === 0) {
      parts.push({ type: 'text', content: text });
    }
    
    // Render each part
    for (const part of parts) {
      if (part.type === 'table') {
        const table = parseMarkdownTable(part.content);
        if (table) {
          container.appendChild(table);
        } else {
          // Fallback to text if parsing fails
          const textNode = renderTextWithLinks(part.content);
          container.appendChild(textNode);
        }
      } else {
        const textNode = renderTextWithLinks(part.content);
        container.appendChild(textNode);
      }
    }
    
    return container;
  }
  
  function renderTextWithLinks(text) {
    const fragment = document.createDocumentFragment();
    const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+[^\s<>"{}|\\^`\[\].,;:!?])/g;
    let lastIndex = 0;
    let match;
    
    // Preserve line breaks and whitespace
    const lines = text.split('\n');
    lines.forEach((line, lineIndex) => {
      if (lineIndex > 0) {
        fragment.appendChild(document.createElement('br'));
      }
      
      lastIndex = 0;
      while ((match = urlRegex.exec(line)) !== null) {
        // Add text before URL
        if (match.index > lastIndex) {
          fragment.appendChild(document.createTextNode(line.substring(lastIndex, match.index)));
        }
        
        // Add link
        const link = document.createElement("a");
        link.href = match[0];
        link.textContent = match[0];
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.style.color = "var(--accent)";
        link.style.textDecoration = "underline";
        fragment.appendChild(link);
        
        lastIndex = match.index + match[0].length;
      }
      
      // Add remaining text
      if (lastIndex < line.length) {
        fragment.appendChild(document.createTextNode(line.substring(lastIndex)));
      }
    });
    
    return fragment;
  }
  
  function parseMarkdownTable(text) {
    const lines = text.trim().split('\n').map(line => line.trim()).filter(line => line);
    if (lines.length < 2) return null;
    
    // Find separator line (contains --- or :---: etc, must start and end with |)
    let separatorIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Check if it's a separator: starts with |, ends with |, contains mostly dashes/colons/spaces
      if (line.startsWith('|') && line.endsWith('|')) {
        // More lenient separator check - just needs dashes
        const cellContent = line.split('|').slice(1, -1).join('');
        if (cellContent.match(/^[\s\-:]+$/) && cellContent.includes('-')) {
          separatorIndex = i;
          break;
        }
      }
    }
    
    if (separatorIndex < 1) return null;
    
    // Header is before separator
    const headerLine = lines[0];
    if (!headerLine.startsWith('|') || !headerLine.endsWith('|')) return null;
    
    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.style.margin = "0.75rem 0";
    table.style.fontSize = "0.9em";
    table.style.display = "block";
    table.style.overflowX = "auto";
    
    // Parse header
    const headerRow = document.createElement("thead");
    const headerTr = document.createElement("tr");
    const headerCells = headerLine.split('|').slice(1, -1).map(c => c.trim());
    
    if (headerCells.length === 0) return null;
    
    headerCells.forEach(cellText => {
      const th = document.createElement("th");
      th.textContent = cellText;
      th.style.padding = "0.6rem 0.75rem";
      th.style.border = "1px solid var(--border)";
      th.style.backgroundColor = "var(--surface)";
      th.style.textAlign = "left";
      th.style.fontWeight = "600";
      th.style.whiteSpace = "nowrap";
      headerTr.appendChild(th);
    });
    headerRow.appendChild(headerTr);
    table.appendChild(headerRow);
    
    // Parse body (skip separator line)
    const tbody = document.createElement("tbody");
    for (let i = separatorIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.startsWith('|') || !line.endsWith('|')) continue;
      
      const tr = document.createElement("tr");
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      
      // Ensure we have the same number of cells as headers
      while (cells.length < headerCells.length) {
        cells.push('');
      }
      
      cells.slice(0, headerCells.length).forEach(cellText => {
        const td = document.createElement("td");
        td.textContent = cellText;
        td.style.padding = "0.6rem 0.75rem";
        td.style.border = "1px solid var(--border)";
        td.style.verticalAlign = "top";
        td.style.wordBreak = "break-word";
        tr.appendChild(td);
      });
      
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    
    return table;
  }

  function addMessage(role, text, pushHistory = true) {
    if (pushHistory) {
      history.push({ role, content: text });
      while (history.length > 10) history.shift();
    }
    const div = document.createElement("div");
    div.className = `message ${role}`;
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = role === "user" ? "You" : "AI";
    
    // Use markdown rendering for AI messages, plain text for user
    if (role === "ai") {
      const content = renderMarkdown(text);
      div.appendChild(label);
      div.appendChild(content);
    } else {
      const p = document.createElement("p");
      p.textContent = text;
      div.appendChild(label);
      div.appendChild(p);
    }
    
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    return div;
  }

  function addTyping() {
    const div = document.createElement("div");
    div.className = "message ai typing";
    div.setAttribute("data-typing", "1");
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = "AI";
    const p = document.createElement("p");
    p.textContent = "Thinking…";
    div.appendChild(label);
    div.appendChild(p);
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    return div;
  }

  function removeTyping(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function resizeTextarea() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 160) + "px";
  }

  input.addEventListener("input", resizeTextarea);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const raw = input.value.trim();
    if (!raw) return;

    addMessage("user", raw);
    input.value = "";
    resizeTextarea();
    send.disabled = true;

    const typingEl = addTyping();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: raw, history }),
      });
      const data = await res.json();
      removeTyping(typingEl);
      addMessage("ai", data.reply || "No response.");
    } catch (err) {
      removeTyping(typingEl);
      addMessage("ai", "Sorry, something went wrong. Is the server running?");
    } finally {
      send.disabled = false;
      input.focus();
    }
  });

  input.focus();
})();
