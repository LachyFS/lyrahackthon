"use client";

import { useState } from "react";
import { FileText, X, ChevronDown, Copy, Check } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TextArtifactProps {
  content: string;
  filename?: string;
  onRemove?: () => void;
  className?: string;
  isPreview?: boolean;
}

// Threshold for detecting large text (characters)
export const LARGE_TEXT_THRESHOLD = 500;

// Detect if pasted content looks like code or structured text
export function detectTextType(content: string): {
  type: "code" | "text";
  language?: string;
  suggestedFilename: string;
} {
  const lines = content.split("\n");
  const firstLine = lines[0]?.trim() || "";

  // Common code patterns
  const codePatterns = [
    { pattern: /^(import|from)\s+/, lang: "python", ext: "py" },
    { pattern: /^(const|let|var|function|class|import|export)\s+/, lang: "javascript", ext: "js" },
    { pattern: /^(interface|type|const|let|var|function|class|import|export)\s+.*[:;]?$/, lang: "typescript", ext: "ts" },
    { pattern: /^<\?php/, lang: "php", ext: "php" },
    { pattern: /^#include\s+[<"]/, lang: "cpp", ext: "cpp" },
    { pattern: /^package\s+\w+/, lang: "java", ext: "java" },
    { pattern: /^(def|class|import|from)\s+/, lang: "python", ext: "py" },
    { pattern: /^\s*{[\s\S]*}$/, lang: "json", ext: "json" },
    { pattern: /^<!DOCTYPE|^<html/i, lang: "html", ext: "html" },
    { pattern: /^<\w+/, lang: "xml", ext: "xml" },
    { pattern: /^#!\s*\//, lang: "shell", ext: "sh" },
    { pattern: /^---\n/, lang: "yaml", ext: "yaml" },
  ];

  // Check for code patterns
  for (const { pattern, lang, ext } of codePatterns) {
    if (pattern.test(firstLine) || pattern.test(content)) {
      return {
        type: "code",
        language: lang,
        suggestedFilename: `pasted.${ext}`,
      };
    }
  }

  // Check for high code-like character density
  const codeChars = (content.match(/[{}[\]();=<>]/g) || []).length;
  const codeCharRatio = codeChars / content.length;

  if (codeCharRatio > 0.05) {
    return {
      type: "code",
      language: "text",
      suggestedFilename: "pasted.txt",
    };
  }

  return {
    type: "text",
    suggestedFilename: "pasted.txt",
  };
}

export function TextArtifact({
  content,
  filename,
  onRemove,
  className,
  isPreview = false,
}: TextArtifactProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const lines = content.split("\n");
  const lineCount = lines.length;
  const charCount = content.length;
  const previewLines = 5;
  const displayContent = isExpanded ? content : lines.slice(0, previewLines).join("\n");
  const hasMore = lines.length > previewLines;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const { type, language } = detectTextType(content);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 5 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 5 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "group relative bg-white/5 border border-white/10 rounded-lg overflow-hidden",
        isPreview && "max-w-sm",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/5">
        <FileText className="h-4 w-4 text-emerald-400 flex-shrink-0" />
        <span className="text-sm text-white font-medium truncate flex-1">
          {filename || "Pasted text"}
        </span>
        <span className="text-xs text-muted-foreground flex-shrink-0">
          {lineCount} line{lineCount !== 1 ? "s" : ""} • {charCount.toLocaleString()} chars
        </span>
        {language && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 flex-shrink-0">
            {language}
          </span>
        )}
        <button
          onClick={handleCopy}
          className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-white transition-colors flex-shrink-0"
          title="Copy content"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-1 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0"
            title="Remove attachment"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Content preview */}
      <div className="relative">
        <pre className="p-3 text-xs text-white/80 font-mono overflow-x-auto whitespace-pre-wrap break-all">
          {displayContent}
          {!isExpanded && hasMore && (
            <span className="text-muted-foreground">...</span>
          )}
        </pre>

        {/* Expand/collapse button */}
        {hasMore && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-center gap-1 py-2 bg-white/5 hover:bg-white/10 text-xs text-muted-foreground hover:text-white transition-colors border-t border-white/10"
          >
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                isExpanded && "rotate-180"
              )}
            />
            {isExpanded ? "Show less" : `Show ${lineCount - previewLines} more lines`}
          </button>
        )}
      </div>
    </motion.div>
  );
}

// Compact preview version for the input area
export function TextArtifactPreview({
  content,
  filename,
  onRemove,
}: {
  content: string;
  filename?: string;
  onRemove: () => void;
}) {
  const lines = content.split("\n").length;
  const chars = content.length;
  const { language } = detectTextType(content);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-sm"
    >
      <FileText className="h-4 w-4 text-emerald-400" />
      <span className="text-white font-medium">{filename || "Pasted text"}</span>
      <span className="text-xs text-emerald-300/70">
        {lines} lines • {chars.toLocaleString()} chars
      </span>
      {language && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
          {language}
        </span>
      )}
      <button
        onClick={onRemove}
        className="p-0.5 rounded hover:bg-red-500/20 text-emerald-300/70 hover:text-red-400 transition-colors"
        title="Remove attachment"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}
