(function () {
  const chat = document.getElementById("chat");
  const form = document.getElementById("form");
  const input = document.getElementById("input");
  const send = document.getElementById("send");

  const history = [];

  function renderMarkdown(text) {
    // Create a container for the rendered content
    const container = document.createElement("div");
    container.style.whiteSpace = "pre-wrap";
    container.style.wordBreak = "break-word";
    
    // Split by table markers (markdown tables)
    const tableRegex = /(\|.+\|[\r\n]+\|[\s\-:]+\|[\r\n]+(?:\|.+\|[\r\n]*)+)/g;
    const parts = text.split(tableRegex);
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      // Check if this part is a table
      if (tableRegex.test(part) || (part.includes('|') && part.includes('\n') && part.split('\n').length >= 2)) {
        const table = parseMarkdownTable(part);
        if (table) {
          container.appendChild(table);
          continue;
        }
      }
      
      // Regular text - convert URLs to links
      const textNode = document.createDocumentFragment();
      const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+[^\s<>"{}|\\^`\[\].,;:!?])/g;
      let lastIndex = 0;
      let match;
      
      while ((match = urlRegex.exec(part)) !== null) {
        // Add text before URL
        if (match.index > lastIndex) {
          const textBefore = document.createTextNode(part.substring(lastIndex, match.index));
          textNode.appendChild(textBefore);
        }
        
        // Add link
        const link = document.createElement("a");
        link.href = match[0];
        link.textContent = match[0];
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.style.color = "var(--accent)";
        link.style.textDecoration = "underline";
        textNode.appendChild(link);
        
        lastIndex = match.index + match[0].length;
      }
      
      // Add remaining text
      if (lastIndex < part.length) {
        textNode.appendChild(document.createTextNode(part.substring(lastIndex)));
      }
      
      container.appendChild(textNode);
    }
    
    return container;
  }
  
  function parseMarkdownTable(text) {
    const lines = text.trim().split('\n').filter(line => line.trim());
    if (lines.length < 2) return null;
    
    // Check if it looks like a markdown table
    const firstLine = lines[0].trim();
    if (!firstLine.startsWith('|') || !firstLine.endsWith('|')) return null;
    
    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.style.margin = "0.5rem 0";
    table.style.fontSize = "0.9em";
    
    // Parse header
    const headerRow = document.createElement("thead");
    const headerTr = document.createElement("tr");
    const headerCells = firstLine.split('|').slice(1, -1).map(c => c.trim());
    
    headerCells.forEach(cellText => {
      const th = document.createElement("th");
      th.textContent = cellText;
      th.style.padding = "0.5rem";
      th.style.border = "1px solid var(--border)";
      th.style.backgroundColor = "var(--surface)";
      th.style.textAlign = "left";
      th.style.fontWeight = "600";
      headerTr.appendChild(th);
    });
    headerRow.appendChild(headerTr);
    table.appendChild(headerRow);
    
    // Parse body (skip separator line)
    const tbody = document.createElement("tbody");
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line.startsWith('|')) continue;
      
      const tr = document.createElement("tr");
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      
      cells.forEach(cellText => {
        const td = document.createElement("td");
        td.textContent = cellText;
        td.style.padding = "0.5rem";
        td.style.border = "1px solid var(--border)";
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
