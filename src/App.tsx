import { useState, useMemo, useCallback } from "react";
import { prompts, categories, type Prompt } from "./data/prompts";
import "./App.css";

// --- プレースホルダー抽出ロジック ---
interface FormField {
  id: string;
  label: string;
  placeholder: string;
  original: string;
}

function extractFields(content: string): FormField[] {
  const fields: FormField[] = [];
  // [○○] と {○○} の両方を対象にする
  const regex = /[\[{]([^\]{}]+)[\]}]/g;
  let match;
  let id = 0;

  while ((match = regex.exec(content)) !== null) {
    const original = match[0];
    const inner = match[1];

    // 出力形式のマーカーなどは除外（①②③ や 表 など）
    if (/^[①-⑩\d]/.test(inner)) continue;
    if (inner === "条件" || inner === "出力形式") continue;

    // 同じ行のブラケット手前のテキストをラベルにする
    const lineStart = content.lastIndexOf("\n", match.index) + 1;
    const beforeBracket = content
      .substring(lineStart, match.index)
      .trim()
      .replace(/^[-\-・※【】]/, "")
      .replace(/[：:]$/, "")
      .trim();

    let label = beforeBracket || `入力 ${id + 1}`;
    let placeholder = "";

    if (inner.startsWith("例：") || inner.startsWith("例:")) {
      placeholder = inner.replace(/^例[：:]/, "");
    } else if (inner === "入力") {
      placeholder = "ここに入力してください";
    } else if (inner.includes("/")) {
      // [はい/いいえ] のような選択肢
      placeholder = inner;
    } else {
      placeholder = inner;
    }

    fields.push({
      id: `field_${id}`,
      label,
      placeholder,
      original,
    });
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
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const textarea = document.createElement("textarea");
      textarea.value = completedPrompt;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
            <h3 className="card-title">{prompt.title}</h3>
            <p className="card-preview">
              {prompt.content.slice(0, 60)}...
            </p>
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
              <h2 className="modal-title">{selectedPrompt.title}</h2>
            </div>

            <div className="modal-body">
              {/* 入力フォーム */}
              {currentFields.length > 0 && (
                <div className="form-section">
                  <h3 className="form-heading">
                    <span>📝</span> あなたの情報を入力
                  </h3>
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
                    </div>
                  ))}
                </div>
              )}

              {/* プレビュー */}
              <div className="preview-section">
                <h3 className="preview-heading">
                  <span>📋</span> 完成プロンプト
                </h3>
                <div className="preview-box">{completedPrompt}</div>
              </div>
            </div>

            {/* コピーボタン */}
            <div className="modal-footer">
              <button
                className={`copy-button ${copied ? "copied" : ""}`}
                onClick={handleCopy}
              >
                {copied ? "✅ コピーしました！" : "📋 プロンプトをコピー"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
