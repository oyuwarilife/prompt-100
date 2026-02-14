import { useState, useMemo, useCallback } from "react";
import { prompts, categories, type Prompt } from "./data/prompts";
import "./App.css";

// --- プレースホルダー抽出ロジック ---
interface FormField {
  id: string;
  label: string;
  placeholder: string;
  hint: string;
  original: string;
}

function extractFields(content: string): FormField[] {
  const fields: FormField[] = [];
  const regex = /[\[{]([^\]{}]+)[\]}]/g;
  let match;
  let id = 0;

  while ((match = regex.exec(content)) !== null) {
    const original = match[0];
    const inner = match[1];

    if (/^[①-⑩\d]/.test(inner)) continue;
    if (inner === "条件" || inner === "出力形式") continue;

    const lineStart = content.lastIndexOf("\n", match.index) + 1;
    const beforeBracket = content
      .substring(lineStart, match.index)
      .trim()
      .replace(/^[-\-・※【】]/, "")
      .replace(/[：:]$/, "")
      .trim();

    let label = beforeBracket || `入力 ${id + 1}`;
    let placeholder = "";
    let hint = "";

    if (inner.startsWith("例：") || inner.startsWith("例:")) {
      const example = inner.replace(/^例[：:]/, "");
      placeholder = example;
      hint = `例：${example}`;
    } else if (inner === "入力") {
      placeholder = "ここに入力してください";
      hint = "自由に入力してください";
    } else if (inner.includes("/")) {
      placeholder = inner;
      hint = `${inner} から選んでください`;
    } else {
      placeholder = inner;
      hint = `${inner} を入力してください`;
    }

    fields.push({ id: `field_${id}`, label, placeholder, hint, original });
    id++;
  }

  return fields;
}

function buildPrompt(
  content: string,
  fields: FormField[],
  values: Record<string, string>
): string {
  let result = content;
  for (const field of fields) {
    const val = values[field.id] || field.original;
    result = result.replace(field.original, val);
  }
  return result;
}

// --- セクション分割ロジック ---
interface PromptSection {
  title: string;
  content: string;
  icon: string;
}

const sectionIconMap: Record<string, string> = {
  あなたの役割: "🤖",
  条件: "📋",
  出力形式: "📤",
};

function parsePromptSections(content: string): PromptSection[] {
  const sections: PromptSection[] = [];
  const parts = content.split(/(?=【[^】]+】)/);

  for (const part of parts) {
    const markerMatch = part.match(/^【([^】]+)】\n?([\s\S]*)/);
    if (markerMatch) {
      const title = markerMatch[1];
      const body = markerMatch[2].trim();
      if (body) {
        sections.push({
          title,
          content: body,
          icon: sectionIconMap[title] || "📄",
        });
      }
    } else if (part.trim()) {
      sections.push({
        title: "あなたの役割",
        content: part.trim(),
        icon: "🤖",
      });
    }
  }

  return sections;
}

// --- カテゴリアイコン ---
const categoryIcons: Record<string, string> = {
  すべて: "📚",
  "自己分析・強み発見": "💎",
  "内省・自分を知る": "🪞",
  ライティング: "✍️",
  SNS運用: "📱",
  "デザイン・資料作成": "🎨",
  "事務・データ入力": "📊",
  "時間管理・効率化": "⏰",
  "学習・スキルアップ": "📖",
  "家庭との両立": "🏠",
};

// --- 折りたたみセクションカード ---
function CollapsibleSection({ section }: { section: PromptSection }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`section-card ${open ? "section-card--open" : ""}`}>
      <button
        className="section-card-title section-card-toggle"
        onClick={() => setOpen(!open)}
        type="button"
      >
        <span>{section.icon}</span>
        <span className="section-card-label">{section.title}</span>
        <span className={`section-card-arrow ${open ? "open" : ""}`}>
          &#9662;
        </span>
      </button>
      {open && (
        <div className="section-card-content">{section.content}</div>
      )}
    </div>
  );
}

// --- メインコンポーネント ---
function App() {
  const [selectedCategory, setSelectedCategory] = useState("すべて");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const filteredPrompts = useMemo(() => {
    return prompts.filter((p) => {
      const matchCategory =
        selectedCategory === "すべて" || p.category === selectedCategory;
      const matchSearch =
        searchQuery === "" ||
        p.title.includes(searchQuery) ||
        p.category.includes(searchQuery) ||
        p.content.includes(searchQuery);
      return matchCategory && matchSearch;
    });
  }, [selectedCategory, searchQuery]);

  const currentFields = useMemo(() => {
    if (!selectedPrompt) return [];
    return extractFields(selectedPrompt.content);
  }, [selectedPrompt]);

  const completedPrompt = useMemo(() => {
    if (!selectedPrompt) return "";
    return buildPrompt(selectedPrompt.content, currentFields, formValues);
  }, [selectedPrompt, currentFields, formValues]);

  const completedSections = useMemo(() => {
    if (!completedPrompt) return [];
    return parsePromptSections(completedPrompt);
  }, [completedPrompt]);

  const handleSelectPrompt = useCallback((prompt: Prompt) => {
    setSelectedPrompt(prompt);
    setFormValues({});
    setCopied(false);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedPrompt(null);
    setFormValues({});
    setCopied(false);
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(completedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = completedPrompt;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }, [completedPrompt]);

  return (
    <div className="app">
      {/* ヘッダー */}
      <header className="header">
        <h1 className="header-title">
          <span className="header-icon">✨</span>
          プロンプト100選
        </h1>
        <p className="header-subtitle">
          主婦の在宅ワークを応援するAIプロンプト集
        </p>
      </header>

      {/* 使い方ガイド */}
      <div className="how-to-use">
        <div className="step">
          <span className="step-number">1</span>
          <span className="step-text">プロンプトを選ぶ</span>
        </div>
        <span className="step-arrow">→</span>
        <div className="step">
          <span className="step-number">2</span>
          <span className="step-text">情報を入力</span>
        </div>
        <span className="step-arrow">→</span>
        <div className="step">
          <span className="step-number">3</span>
          <span className="step-text">コピーしてAIに貼り付け</span>
        </div>
      </div>

      {/* 検索 */}
      <div className="search-bar">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          placeholder="キーワードで検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        {searchQuery && (
          <button
            className="search-clear"
            onClick={() => setSearchQuery("")}
            aria-label="検索をクリア"
          >
            ✕
          </button>
        )}
      </div>

      {/* カテゴリタブ */}
      <div className="category-tabs">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`category-tab ${selectedCategory === cat ? "active" : ""}`}
            onClick={() => setSelectedCategory(cat)}
          >
            <span className="tab-icon">{categoryIcons[cat] || "📄"}</span>
            <span className="tab-label">{cat}</span>
          </button>
        ))}
      </div>

      {/* 件数表示 */}
      <div className="result-count">
        {filteredPrompts.length} 件のプロンプト
      </div>

      {/* プロンプトカード一覧 */}
      <div className="prompt-grid">
        {filteredPrompts.map((prompt) => (
          <button
            key={prompt.id}
            className="prompt-card"
            onClick={() => handleSelectPrompt(prompt)}
          >
            <span className="card-category">
              {categoryIcons[prompt.category]} {prompt.category}
            </span>
            <h3 className="card-title">
              <span className="card-number">
                #{String(prompt.id).padStart(3, "0")}
              </span>
              {prompt.title}
            </h3>
            <p className="card-preview">{prompt.description}</p>
          </button>
        ))}
      </div>

      {filteredPrompts.length === 0 && (
        <div className="empty-state">
          <p>該当するプロンプトが見つかりませんでした</p>
        </div>
      )}

      {/* フォームモーダル */}
      {selectedPrompt && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={handleCloseModal}>
              ✕
            </button>

            <div className="modal-header">
              <span className="modal-category">
                {categoryIcons[selectedPrompt.category]}{" "}
                {selectedPrompt.category}
              </span>
              <h2 className="modal-title">
                <span className="modal-number">
                  #{String(selectedPrompt.id).padStart(3, "0")}
                </span>
                {selectedPrompt.title}
              </h2>
              {selectedPrompt.description && (
                <div className="modal-description">
                  <span className="description-icon">🎯</span>
                  <div>
                    <span className="description-label">ねらい</span>
                    <p className="description-text">
                      {selectedPrompt.description}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-body">
              {/* ユーザー入力フォーム */}
              {currentFields.length > 0 && (
                <div className="section-card section-card--input">
                  <h3 className="section-card-title">
                    <span>📝</span>
                    <span className="section-card-label">ユーザー入力</span>
                  </h3>
                  <div className="section-card-body">
                    {currentFields.map((field) => (
                      <div key={field.id} className="form-field">
                        <label className="form-label" htmlFor={field.id}>
                          {field.label}
                        </label>
                        <textarea
                          id={field.id}
                          className="form-input"
                          placeholder={field.placeholder}
                          value={formValues[field.id] || ""}
                          onChange={(e) =>
                            setFormValues((prev) => ({
                              ...prev,
                              [field.id]: e.target.value,
                            }))
                          }
                          rows={2}
                        />
                        {field.hint && (
                          <span className="form-hint">💡 {field.hint}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* セクションカード（折りたたみ） */}
              {completedSections.map((section, i) => (
                <CollapsibleSection key={i} section={section} />
              ))}
            </div>

            {/* コピーボタン */}
            <div className="modal-footer">
              <button
                className={`copy-button ${copied ? "copied" : ""}`}
                onClick={handleCopy}
              >
                {copied
                  ? "✅ コピーしました！ChatGPTに貼り付けてね"
                  : "📋 プロンプトをコピー"}
              </button>
              <p className="copy-guide">
                コピーしたら ChatGPT や Claude に貼り付けて使えます
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
