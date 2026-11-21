// Replace this placeholder with your deployed Cloudflare Worker URL.
const WORKER_URL = "https://icy-night-cf6a.joeyluuson.workers.dev/";

// Keep the strict advisor instructions in one place.
const SYSTEM_PROMPT =
  "You are a knowledgeable L'Oréal beauty advisor. Only answer questions about the generated routine, L'Oréal products, skincare, haircare, makeup, fragrance, or beauty routines. Politely redirect unrelated questions. Use selected product details accurately, recommend safe and practical usage, and do not diagnose medical conditions.";

// Get references to the page elements.
const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const clearSelected = document.getElementById("clearSelected");
const generateRoutine = document.getElementById("generateRoutine");
const selectionMessage = document.getElementById("selectionMessage");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const languageToggle = document.getElementById("languageToggle");
const productModal = document.getElementById("productModal");
const closeModal = document.getElementById("closeModal");
const modalTitle = document.getElementById("modalTitle");
const modalBrand = document.getElementById("modalBrand");
const modalDescription = document.getElementById("modalDescription");

let allProducts = [];
let selectedProductIds = new Set();
let activeDescriptionButton = null;

// conversationHistory always contains the complete OpenAI message context.
const conversationHistory = [{ role: "system", content: SYSTEM_PROMPT }];

// Safely turn text into HTML text when inserting it into the page.
function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Load product data once from the local JSON file.
async function loadProducts() {
  const response = await fetch("products.json");
  if (!response.ok) {
    throw new Error("Could not load products.");
  }
  const data = await response.json();
  allProducts = data.products;
  restoreSelectedProducts();
  displayFilteredProducts();
}

// Restore saved product IDs from localStorage.
function restoreSelectedProducts() {
  let savedIds = [];
  try {
    savedIds = JSON.parse(localStorage.getItem("selectedProductIds") || "[]");
    if (!Array.isArray(savedIds)) savedIds = [];
  } catch (error) {
    savedIds = [];
  }
  const validIds = new Set(allProducts.map((product) => String(product.id)));
  selectedProductIds = new Set(
    savedIds.map(String).filter((id) => validIds.has(id)),
  );
  updateSelectedProducts();
}

// Save selected IDs after every selection change.
function saveSelectedProducts() {
  try {
    localStorage.setItem(
      "selectedProductIds",
      JSON.stringify(Array.from(selectedProductIds)),
    );
  } catch (error) {
    // The app still works for this visit if browser storage is unavailable.
  }
}

// Combine the category and search filters.
function displayFilteredProducts() {
  const category = categoryFilter.value;
  const searchText = productSearch.value.trim().toLowerCase();

  const filteredProducts = allProducts.filter((product) => {
    const matchesCategory = !category || product.category === category;
    const searchableText =
      `${product.name} ${product.brand} ${product.category} ${product.description}`.toLowerCase();
    const matchesSearch = !searchText || searchableText.includes(searchText);
    return matchesCategory && matchesSearch;
  });

  if (filteredProducts.length === 0) {
    productsContainer.innerHTML =
      '<div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i><p>No products match your filters.</p></div>';
    return;
  }

  productsContainer.innerHTML = filteredProducts
    .map((product) => {
      const id = String(product.id);
      const isSelected = selectedProductIds.has(id);
      return `
        <article
          class="product-card${isSelected ? " selected" : ""}"
          data-product-id="${id}"
          role="button"
          tabindex="0"
          aria-pressed="${isSelected}"
          aria-label="${isSelected ? "Deselect" : "Select"} ${escapeHtml(product.name)}"
        >
          ${isSelected ? '<span class="selected-badge"><i class="fa-solid fa-check"></i> Selected</span>' : ""}
          <button
            class="info-button"
            type="button"
            aria-label="View description for ${escapeHtml(product.name)}"
            aria-expanded="false"
            data-description-id="${id}"
          >
            <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
          </button>
          <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" />
          <div class="product-info">
            <p class="product-brand">${escapeHtml(product.brand)}</p>
            <h3>${escapeHtml(product.name)}</h3>
          </div>
        </article>
      `;
    })
    .join("");

  addProductCardListeners();
}

// Add click and keyboard behavior to each rendered card.
function addProductCardListeners() {
  document.querySelectorAll(".product-card").forEach((card) => {
    card.addEventListener("click", () => toggleProduct(card.dataset.productId));
    card.addEventListener("keydown", (event) => {
      if (event.target !== card) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleProduct(card.dataset.productId);
      }
    });
  });

  document.querySelectorAll(".info-button").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openProductModal(button.dataset.descriptionId, button);
    });
  });
}

// Toggle a product in or out of the selected set.
function toggleProduct(productId) {
  if (selectedProductIds.has(productId)) {
    selectedProductIds.delete(productId);
  } else {
    selectedProductIds.add(productId);
  }
  saveSelectedProducts();
  updateSelectedProducts();
  displayFilteredProducts();
  selectionMessage.textContent = "";
}

// Display chips and a clear button for selected products.
function updateSelectedProducts() {
  const selectedProducts = allProducts.filter((product) =>
    selectedProductIds.has(String(product.id)),
  );

  clearSelected.hidden = selectedProducts.length === 0;

  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML =
      '<p class="selected-empty">No products selected yet.</p>';
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
        <div class="selected-chip">
          <span>${escapeHtml(product.name)}</span>
          <button
            type="button"
            aria-label="Remove ${escapeHtml(product.name)}"
            data-remove-id="${product.id}"
          >
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
      `,
    )
    .join("");

  document.querySelectorAll("[data-remove-id]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleProduct(String(button.dataset.removeId));
    });
  });
}

// Open an accessible native dialog with the full product description.
function openProductModal(productId, button) {
  const product = allProducts.find((item) => String(item.id) === productId);
  if (!product) return;

  activeDescriptionButton = button;
  modalTitle.textContent = product.name;
  modalBrand.textContent = product.brand;
  modalDescription.textContent = product.description;
  button.setAttribute("aria-expanded", "true");
  productModal.showModal();
}

function closeProductModal() {
  if (activeDescriptionButton) {
    activeDescriptionButton.setAttribute("aria-expanded", "false");
  }
  productModal.close();
  activeDescriptionButton = null;
}

// Convert simple markdown into clean HTML for chat messages.
function formatAssistantText(text) {
  const lines = text.split("\n");
  let html = "";
  let inList = false;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      return;
    }

    if (/^#{1,3}\s/.test(trimmed)) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      const headingText = escapeHtml(trimmed.replace(/^#{1,3}\s*/, ""));
      html += `<h3>${formatInlineText(headingText)}</h3>`;
    } else if (/^[-*]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      const itemText = escapeHtml(trimmed.replace(/^([-*]|\d+\.)\s*/, ""));
      html += `<li>${formatInlineText(itemText)}</li>`;
    } else {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      const paragraphText = escapeHtml(trimmed);
      html += `<p>${formatInlineText(paragraphText)}</p>`;
    }
  });

  if (inList) html += "</ul>";
  return html;
}

// Add bold text and safe clickable links.
function formatInlineText(text) {
  let formatted = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  formatted = formatted.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  return formatted;
}

function appendChatMessage(role, content, citations = []) {
  chatWindow.querySelector(".chat-placeholder")?.remove();

  const message = document.createElement("div");
  message.className = `chat-message ${role}`;

  if (role === "assistant") {
    let citationsHtml = "";
    if (citations.length > 0) {
      citationsHtml =
        '<div class="chat-citations"><strong>Sources</strong><ul>' +
        citations
          .map((citation) => {
            const title = escapeHtml(citation.title || "Web source");
            const url = escapeHtml(citation.url);
            return `<li><a href="${url}" target="_blank" rel="noopener noreferrer">${title}</a></li>`;
          })
          .join("") +
        "</ul></div>";
    }
    message.innerHTML =
      '<div class="message-avatar">L</div><div class="message-body">' +
      formatAssistantText(content) +
      citationsHtml +
      "</div>";
  } else {
    message.innerHTML = `<div class="message-body">${escapeHtml(content)}</div><div class="message-avatar">You</div>`;
  }

  chatWindow.appendChild(message);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function showLoadingMessage() {
  const loading = document.createElement("div");
  loading.className = "chat-message assistant loading-message";
  loading.id = "loadingMessage";
  loading.innerHTML =
    '<div class="message-avatar">L</div><div class="message-body"><span></span><span></span><span></span></div>';
  chatWindow.appendChild(loading);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function removeLoadingMessage() {
  document.getElementById("loadingMessage")?.remove();
}

// Disable both ways to submit so only one request can run at a time.
function setRequestPending(isPending) {
  generateRoutine.disabled = isPending;
  sendBtn.disabled = isPending;
}

// Send a request to the Cloudflare Worker and append the OpenAI response.
async function sendToWorker() {
  if (WORKER_URL === "[YOUR_CLOUDFLARE_WORKER_URL]") {
    throw new Error(
      "The Cloudflare Worker URL has not been configured yet. Please add your deployed worker URL in script.js.",
    );
  }

  const response = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: conversationHistory }),
  });

  const responseText = await response.text();
  let data = {};

  try {
    data = JSON.parse(responseText);
  } catch (error) {
    throw new Error("Received an invalid response from the server.");
  }

  if (!response.ok) {
    throw new Error(data.error || "The beauty advisor is unavailable right now.");
  }

  const assistantContent =
    data?.choices?.[0]?.message?.content ||
    data?.reply ||
    data?.output_text ||
    "";

  if (data.error) {
    throw new Error(data.error);
  }

  if (!assistantContent) {
    throw new Error("The beauty advisor returned an empty response.");
  }
  return { content: assistantContent, citations: data.citations || [] };
}

// Generate a routine from only the currently selected products.
generateRoutine.addEventListener("click", async () => {
  if (selectedProductIds.size === 0) {
    selectionMessage.textContent =
      "Please select at least one product to build your routine.";
    return;
  }
  if (generateRoutine.disabled || sendBtn.disabled) return;

  const selectedProducts = allProducts
    .filter((product) => selectedProductIds.has(String(product.id)))
    .map((product) => ({
      name: product.name,
      brand: product.brand,
      category: product.category,
      description: product.description,
    }));

  selectionMessage.textContent = "";
  const userMessage =
    "Build a personalized beauty routine using only these selected products: " +
    JSON.stringify(selectedProducts) +
    ". Include a clear step-by-step order and explain when to use each product.";

  conversationHistory.push({ role: "user", content: userMessage });
  appendChatMessage("user", "Create a routine with my selected products.");
  showLoadingMessage();
  setRequestPending(true);

  try {
    const result = await sendToWorker();
    removeLoadingMessage();
    if (result) {
      conversationHistory.push({
        role: "assistant",
        content: result.content,
      });
      appendChatMessage("assistant", result.content, result.citations);
    }
  } catch (error) {
    conversationHistory.pop();
    removeLoadingMessage();
    const errorMessage = error?.message
      ? `I could not create your routine: ${error.message}`
      : "I could not create your routine right now. Please check your connection and try again.";
    appendChatMessage(
      "assistant",
      errorMessage,
    );
  } finally {
    setRequestPending(false);
  }
});

// Follow-up questions use the full conversation history.
chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (generateRoutine.disabled || sendBtn.disabled) return;

  const message = userInput.value.trim();
  if (!message) return;

  conversationHistory.push({ role: "user", content: message });
  appendChatMessage("user", message);
  userInput.value = "";
  showLoadingMessage();
  setRequestPending(true);

  try {
    const result = await sendToWorker();
    removeLoadingMessage();
    if (result) {
      conversationHistory.push({
        role: "assistant",
        content: result.content,
      });
      appendChatMessage("assistant", result.content, result.citations);
    }
  } catch (error) {
    conversationHistory.pop();
    removeLoadingMessage();
    const errorMessage = error?.message
      ? `I could not answer that right now: ${error.message}`
      : "I could not answer that right now. Please check your connection and try again.";
    appendChatMessage(
      "assistant",
      errorMessage,
    );
  } finally {
    setRequestPending(false);
  }
});

categoryFilter.addEventListener("change", displayFilteredProducts);
productSearch.addEventListener("input", displayFilteredProducts);

clearSelected.addEventListener("click", () => {
  selectedProductIds.clear();
  saveSelectedProducts();
  updateSelectedProducts();
  displayFilteredProducts();
  selectionMessage.textContent = "";
});

closeModal.addEventListener("click", closeProductModal);
productModal.addEventListener("click", (event) => {
  if (event.target === productModal) closeProductModal();
});
productModal.addEventListener("close", () => {
  if (activeDescriptionButton) {
    activeDescriptionButton.setAttribute("aria-expanded", "false");
  }
  activeDescriptionButton = null;
});

// Persist the reading direction and update the toggle label.
function setRtlMode(isRtl) {
  document.documentElement.dir = isRtl ? "rtl" : "ltr";
  document.documentElement.lang = isRtl ? "ar" : "en";
  languageToggle.textContent = isRtl ? "AR / EN" : "EN / AR";
  languageToggle.setAttribute(
    "aria-label",
    isRtl ? "Switch to left-to-right layout" : "Switch to right-to-left layout",
  );
  try {
    localStorage.setItem("routineDirection", isRtl ? "rtl" : "ltr");
  } catch (error) {
    // The layout still changes for this visit if browser storage is unavailable.
  }
}

languageToggle.addEventListener("click", () => {
  setRtlMode(document.documentElement.dir !== "rtl");
});

let savedDirection = "ltr";
try {
  savedDirection = localStorage.getItem("routineDirection") || "ltr";
} catch (error) {
  savedDirection = "ltr";
}
setRtlMode(savedDirection === "rtl");

// Start with a friendly empty chat message.
chatWindow.innerHTML =
  '<div class="chat-placeholder">Select products, then generate a personalized routine.</div>';

loadProducts().catch(() => {
  productsContainer.innerHTML =
    '<div class="empty-state"><p>Products could not be loaded.</p></div>';
});
