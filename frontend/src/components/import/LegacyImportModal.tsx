import React, { useState, useCallback } from "react";
import { X, Upload, AlertCircle, CheckCircle, FileJson } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { authService } from "@/services/auth/authService";
import { env } from "@/config/env";

interface ImportProgress {
  current_step: string;
  percentage: number;
  total_nodes: number;
  processed_nodes: number;
  total_edges: number;
  processed_edges: number;
  errors: string[];
}

interface ImportResult {
  project_id: string;
  imported_nodes: number;
  imported_edges: number;
  errors: string[];
  warnings: string[];
}

interface LegacyImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LegacyImportModal: React.FC<LegacyImportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [jsonData, setJsonData] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setValidationResult(null);
    setResult(null);

    try {
      const text = await selectedFile.text();
      const data = JSON.parse(text);
      setJsonData(data);

      // Validate the data
      await validateData(data);
    } catch (err) {
      setError(
        "Invalid JSON file. Please ensure the file contains valid JSON data."
      );
      setJsonData(null);
    }
  };

  const validateData = async (data: any) => {
    try {
      const apiUrl =
        env.API_BASE_URL;
      const token = authService.getToken();

      const response = await fetch(`${apiUrl}/legacy/import/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      setValidationResult(result);
    } catch (err) {
      setError("Failed to validate data");
    }
  };

  const handleImport = async () => {
    if (!jsonData) return;

    setIsImporting(true);
    setError(null);
    setProgress(null);
    setResult(null);

    try {
      const apiUrl =
        env.API_BASE_URL;
      const token = authService.getToken();

      const response = await fetch(`${apiUrl}/legacy/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(jsonData),
      });

      if (!response.ok) {
        throw new Error("Import request failed");
      }

      // Read the SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));

              if (event.type === "progress") {
                setProgress(event.data);
              } else if (event.type === "complete") {
                setResult(event.data);
                setIsImporting(false);
              } else if (event.type === "error") {
                setError(event.message);
                setIsImporting(false);
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setIsImporting(false);
    }
  };

  const handleNavigateToProject = () => {
    if (result?.project_id) {
      navigate(`/projects/${result.project_id}`);
      onClose();
    }
  };

  const reset = () => {
    setFile(null);
    setJsonData(null);
    setValidationResult(null);
    setProgress(null);
    setResult(null);
    setError(null);
    setIsImporting(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-neutral-900 rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-neutral-800">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-white">
              Import Legacy Project
            </h2>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white"
              disabled={isImporting}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {!file && !result && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-neutral-700 rounded-lg p-8">
                <div className="text-center">
                  <FileJson
                    size={48}
                    className="mx-auto text-neutral-500 mb-4"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <span className="text-blue-400 hover:text-blue-300">
                      Choose a JSON file
                    </span>
                    <span className="text-neutral-400"> or drag and drop</span>
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <p className="text-sm text-neutral-500 mt-2">
                    Only JSON files from legacy Pwnflow are supported
                  </p>
                </div>
              </div>
            </div>
          )}

          {validationResult && !isImporting && !result && (
            <div className="space-y-4">
              <div className="bg-neutral-800 rounded-lg p-4">
                <h3 className="text-white font-medium mb-3">
                  Validation Results
                </h3>

                {validationResult.valid ? (
                  <div className="flex items-center text-green-400 mb-2">
                    <CheckCircle size={20} className="" />
                    <span>Data is valid and ready to import</span>
                  </div>
                ) : (
                  <div className="flex items-center text-red-400 mb-2">
                    <AlertCircle size={20} className="" />
                    <span>Validation errors found</span>
                  </div>
                )}

                {validationResult.summary && (
                  <div className="mt-4 space-y-2 text-sm">
                    <p className="text-neutral-300">
                      Project:{" "}
                      <span className="text-white">
                        {validationResult.summary.project_name}
                      </span>
                    </p>
                    <p className="text-neutral-300">
                      Nodes:{" "}
                      <span className="text-white">
                        {validationResult.summary.nodes_count}
                      </span>
                    </p>
                    <p className="text-neutral-300">
                      Relationships:{" "}
                      <span className="text-white">
                        {validationResult.summary.edges_count}
                      </span>
                    </p>
                  </div>
                )}

                {validationResult.errors?.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-red-400 text-sm font-medium mb-2">
                      Errors:
                    </h4>
                    <ul className="list-disc list-inside text-sm text-neutral-400">
                      {validationResult.errors.map(
                        (err: string, idx: number) => (
                          <li key={idx}>{err}</li>
                        )
                      )}
                    </ul>
                  </div>
                )}

                {validationResult.warnings?.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-yellow-400 text-sm font-medium mb-2">
                      Warnings:
                    </h4>
                    <ul className="list-disc list-inside text-sm text-neutral-400">
                      {validationResult.warnings.map(
                        (warn: string, idx: number) => (
                          <li key={idx}>{warn}</li>
                        )
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {isImporting && progress && (
            <div className="space-y-4">
              <div className="bg-neutral-800 rounded-lg p-4">
                <h3 className="text-white font-medium mb-3">Import Progress</h3>

                <div className="mb-4">
                  <div className="flex justify-between text-sm text-neutral-400 mb-2">
                    <span>{progress.current_step}</span>
                    <span>{Math.round(progress.percentage)}%</span>
                  </div>
                  <div className="w-full bg-neutral-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-neutral-400">Nodes</p>
                    <p className="text-white">
                      {progress.processed_nodes} / {progress.total_nodes}
                    </p>
                  </div>
                  <div>
                    <p className="text-neutral-400">Relationships</p>
                    <p className="text-white">
                      {progress.processed_edges} / {progress.total_edges}
                    </p>
                  </div>
                </div>

                {progress.errors?.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-red-400 text-sm font-medium mb-2">
                      Errors:
                    </h4>
                    <ul className="list-disc list-inside text-sm text-neutral-400">
                      {progress.errors.map((err: string, idx: number) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="bg-green-900 bg-opacity-20 border border-green-700 rounded-lg p-4">
                <div className="flex items-center text-green-400 mb-3">
                  <CheckCircle size={24} className="" />
                  <h3 className="font-medium">
                    Import Completed Successfully!
                  </h3>
                </div>

                <div className="space-y-2 text-sm">
                  <p className="text-neutral-300">
                    Imported{" "}
                    <span className="text-white">{result.imported_nodes}</span>{" "}
                    nodes and{" "}
                    <span className="text-white">{result.imported_edges}</span>{" "}
                    relationships
                  </p>
                </div>

                {result.errors?.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-red-400 text-sm font-medium mb-2">
                      Errors:
                    </h4>
                    <ul className="list-disc list-inside text-sm text-neutral-400">
                      {result.errors.map((err: string, idx: number) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.warnings?.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-yellow-400 text-sm font-medium mb-2">
                      Warnings:
                    </h4>
                    <ul className="list-disc list-inside text-sm text-neutral-400">
                      {result.warnings.map((warn: string, idx: number) => (
                        <li key={idx}>{warn}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-900 bg-opacity-20 border border-red-700 rounded-lg p-4">
              <div className="flex items-center text-red-400">
                <AlertCircle size={20} className="" />
                <span>{error}</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-neutral-800">
          <div className="flex justify-end space-x-3">
            {!result && (
              <>
                <button
                  onClick={reset}
                  className="px-4 py-2 text-neutral-400 hover:text-white"
                  disabled={isImporting}
                >
                  Reset
                </button>
                <button
                  onClick={handleImport}
                  disabled={!validationResult?.valid || isImporting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  <Upload size={16} className="" />
                  {isImporting ? "Importing..." : "Import Project"}
                </button>
              </>
            )}
            {result && (
              <>
                <button
                  onClick={reset}
                  className="px-4 py-2 text-neutral-400 hover:text-white"
                >
                  Import Another
                </button>
                <button
                  onClick={handleNavigateToProject}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Open Project
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
