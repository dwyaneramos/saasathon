import { useEffect, useMemo, useState } from "react";
import GraphView from "@/components/GraphView";
import type { CategorySummary, DocumentSummary, GraphNode } from "@/types/graph";

type GraphMode = "categories" | "files";
type CategoriesResponse = { categories?: CategorySummary[]; error?: string };
type DocumentsResponse = { documents?: DocumentSummary[]; error?: string };

const apiBaseUrl = "http://localhost:3000/api/v1";

export default function Graph() {
  const [is2D, setIs2D] = useState(true);
  const [mode, setMode] = useState<GraphMode>("categories");
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);

  useEffect(() => {
    let ignore = false;
    const token = localStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    async function loadGraphData() {
      const [categoriesResponse, documentsResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/categories`, { headers }),
        fetch(`${apiBaseUrl}/documents`, { headers }),
      ]);

      const categoriesPayload = (await categoriesResponse.json().catch(() => null)) as CategoriesResponse | null;
      const documentsPayload = (await documentsResponse.json().catch(() => null)) as DocumentsResponse | null;

      if (!categoriesResponse.ok || !documentsResponse.ok) {
        return;
      }

      if (!ignore) {
        setCategories(categoriesPayload?.categories ?? []);
        setDocuments(documentsPayload?.documents ?? []);
      }
    }

    loadGraphData();

    return () => {
      ignore = true;
    };
  }, []);

  const categoryNodes = useMemo<GraphNode[]>(() => {
    return categories.map((category) => ({
      id: `category-${category.id}`,
      label: category.name,
      categoryId: category.id,
    }));
  }, [categories]);

  const fileNodes = useMemo<GraphNode[]>(() => {
    return documents
      .filter((document) => document.categoryId === activeCategoryId)
      .map((document) => ({
        id: `document-${document.id}`,
        label: document.originalFileName || document.fileName || document.filename,
        documentId: document.id,
      }));
  }, [activeCategoryId, documents]);

  const currentNodes = mode === "categories" ? categoryNodes : fileNodes;
  const currentMatrix = useMemo(() => buildConnectedMatrix(currentNodes.length), [currentNodes.length]);

  const handleNodeClick = (node: GraphNode) => {
    if (mode === "categories" && node.categoryId) {
      setActiveCategoryId(node.categoryId);
      setMode("files");
    }
  };

  return (
    <div className="graph-page relative flex-1 overflow-hidden rounded-2xl border border-stone-200 bg-stone-50">
      <div className="absolute left-5 top-5 z-20 flex gap-3">
        <button
          onClick={() => setIs2D((current) => !current)}
          className="rounded bg-gray-900 px-4 py-2 text-white transition hover:bg-gray-700"
        >
          {is2D ? "Switch to 3D" : "Switch to 2D"}
        </button>

        {mode === "files" ? (
          <button
            onClick={() => {
              setMode("categories");
              setActiveCategoryId(null);
            }}
            className="rounded border border-stone-300 bg-white px-4 py-2 text-stone-700 transition hover:bg-stone-100"
          >
            Back
          </button>
        ) : null}
      </div>

      <div className="absolute inset-0 z-0">
        {currentNodes.length > 0 ? (
          <GraphView
            is2D={is2D}
            nodes={currentNodes}
            weightMatrix={currentMatrix}
            threshold={0.16}
            onNodeClick={handleNodeClick}
          />
        ) : null}
      </div>
    </div>
  );
}

function buildConnectedMatrix(nodeCount: number) {
  const matrix: number[][] = Array.from({ length: nodeCount }, () =>
    Array.from({ length: nodeCount }, () => 0),
  );

  for (let i = 0; i < nodeCount; i++) {
    for (let j = i + 1; j < nodeCount; j++) {
      let weight = 0.08;

      if (Math.abs(i - j) === 1) {
        weight = 0.42;
      }

      if ((i === 0 && j === nodeCount - 1) || (j === 0 && i === nodeCount - 1)) {
        weight = Math.max(weight, 0.28);
      }

      matrix[i][j] = weight;
      matrix[j][i] = weight;
    }
  }

  return matrix;
}
