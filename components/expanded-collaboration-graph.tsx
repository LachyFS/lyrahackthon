"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Badge } from "@/components/ui/badge";
import { Filter } from "lucide-react";
import type { CollaborationData, GitHubProfile } from "@/lib/actions/github-analyze";

interface ExpandedCollaborationGraphProps {
  profile: GitHubProfile;
  collaboration: CollaborationData;
}

type FilterType = "all" | 1 | 2;

// Custom node component for user avatars
function UserNode({ data }: { data: { label: string; avatar: string; isCenter?: boolean; type?: string; degree?: number; relationship?: string } }) {
  const getBorderColor = () => {
    if (data.isCenter) return "border-emerald-500 ring-4 ring-emerald-500/30";
    if (data.degree === 2) return "border-gray-500/50";
    switch (data.type) {
      case "org":
        return "border-purple-500";
      case "contributor":
        return "border-cyan-500";
      case "following":
        return "border-blue-500";
      case "follower":
        return "border-amber-500";
      default:
        return "border-white/20";
    }
  };

  const getSize = () => {
    if (data.isCenter) return "w-24 h-24";
    if (data.degree === 1) return "w-14 h-14";
    return "w-10 h-10"; // 2nd degree smaller
  };

  return (
    <div className="flex flex-col items-center gap-1 group cursor-pointer relative">
      {/* Handles for edge connections */}
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-1 !h-1" />
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-1 !h-1" />
      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0 !w-1 !h-1" />
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0 !w-1 !h-1" />

      <div
        className={`rounded-full border-2 ${getBorderColor()} overflow-hidden ${getSize()} bg-background transition-all group-hover:scale-110 group-hover:z-10`}
      >
        <img
          src={data.avatar}
          alt={data.label}
          className="w-full h-full object-cover"
        />
      </div>
      <span
        className={`text-xs ${
          data.isCenter ? "font-bold text-white" : data.degree === 1 ? "font-medium text-white/90" : "text-white/60"
        } max-w-[80px] truncate text-center`}
      >
        {data.label}
      </span>
      {data.degree && !data.isCenter && (
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
          data.degree === 1 ? "bg-emerald-500/20 text-emerald-300" : "bg-gray-500/20 text-gray-400"
        }`}>
          {data.degree === 1 ? "1st" : "2nd"}
        </span>
      )}
    </div>
  );
}

const nodeTypes = {
  userNode: UserNode,
};

export function ExpandedCollaborationGraph({ profile, collaboration }: ExpandedCollaborationGraphProps) {
  const { collaborators, connections } = collaboration;
  const [degreeFilter, setDegreeFilter] = useState<FilterType>("all");

  const firstDegree = collaborators.filter(c => c.degree === 1);
  const secondDegree = collaborators.filter(c => c.degree === 2);

  // Generate nodes and edges based on connections data
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const centerX = 450;
    const centerY = 350;

    // Filter collaborators based on degree filter
    const filteredCollabs = degreeFilter === "all"
      ? collaborators
      : collaborators.filter(c => c.degree === degreeFilter);

    // Center node (the profile being analyzed)
    nodes.push({
      id: profile.login,
      type: "userNode",
      position: { x: centerX, y: centerY },
      data: {
        label: profile.login,
        avatar: profile.avatar_url,
        isCenter: true,
      },
    });

    // Position 1st degree connections in inner circle
    const firstDegreeFiltered = filteredCollabs.filter(c => c.degree === 1);
    const radius1 = 200;
    const angleStep1 = (2 * Math.PI) / Math.max(firstDegreeFiltered.length, 1);

    firstDegreeFiltered.forEach((collab, index) => {
      const angle = angleStep1 * index - Math.PI / 2;
      const x = centerX + radius1 * Math.cos(angle);
      const y = centerY + radius1 * Math.sin(angle);

      nodes.push({
        id: collab.login,
        type: "userNode",
        position: { x, y },
        data: {
          label: collab.login,
          avatar: collab.avatar_url,
          type: collab.type,
          degree: 1,
          relationship: collab.relationship,
        },
      });
    });

    // Position 2nd degree connections in outer circle
    if (degreeFilter === "all" || degreeFilter === 2) {
      const secondDegreeFiltered = collaborators.filter(c => c.degree === 2);
      const radius2 = 380;
      const angleStep2 = (2 * Math.PI) / Math.max(secondDegreeFiltered.length, 1);

      secondDegreeFiltered.forEach((collab, index) => {
        const angle = angleStep2 * index - Math.PI / 2 + 0.2; // Slight offset
        const x = centerX + radius2 * Math.cos(angle);
        const y = centerY + radius2 * Math.sin(angle);

        nodes.push({
          id: collab.login,
          type: "userNode",
          position: { x, y },
          data: {
            label: collab.login,
            avatar: collab.avatar_url,
            type: collab.type,
            degree: 2,
            relationship: collab.relationship,
          },
        });
      });
    }

    // Create edges from connections data
    const nodeIds = new Set(nodes.map(n => n.id));

    connections.forEach((conn, index) => {
      // Only create edge if both nodes exist in our filtered view
      if (nodeIds.has(conn.source) && nodeIds.has(conn.target)) {
        let edgeColor = "#6b7280";
        let strokeWidth = 1;
        let animated = false;
        let opacity = 1;

        // Determine if this is a 1st or 2nd degree connection
        const isSecondDegree = conn.source !== profile.login && conn.target !== profile.login;

        if (isSecondDegree) {
          edgeColor = "#4b5563";
          strokeWidth = 1;
          opacity = 0.5;
        } else {
          switch (conn.type) {
            case "org":
              edgeColor = "#a855f7";
              strokeWidth = 3;
              break;
            case "contributor":
              edgeColor = "#06b6d4";
              strokeWidth = 2;
              animated = true;
              break;
            case "mutual":
              edgeColor = "#10b981";
              strokeWidth = 2;
              break;
            case "following":
              edgeColor = "#3b82f6";
              strokeWidth = 1.5;
              break;
            case "follower":
              edgeColor = "#f59e0b";
              strokeWidth = 1.5;
              break;
          }
        }

        edges.push({
          id: `edge-${index}-${conn.source}-${conn.target}`,
          source: conn.source,
          target: conn.target,
          type: "default",
          style: { stroke: edgeColor, strokeWidth, opacity },
          animated,
          markerEnd: conn.type === "follower" && !isSecondDegree ? {
            type: MarkerType.ArrowClosed,
            color: edgeColor,
          } : undefined,
        });
      }
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [profile, collaborators, connections, degreeFilter]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (node.id !== profile.login) {
      window.open(`https://github.com/${node.id}`, "_blank");
    }
  }, [profile.login]);

  if (collaborators.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-12 text-center">
        <p className="text-muted-foreground">No collaboration data available for this user.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      {/* Header with filters */}
      <div className="px-4 py-3 border-b border-white/5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Degree:</span>
          </div>
          <div className="flex gap-2">
            <Badge
              variant="outline"
              className={`cursor-pointer transition-all ${
                degreeFilter === "all"
                  ? "border-white/30 bg-white/10 ring-1 ring-white/20"
                  : "border-white/10 hover:border-white/20"
              }`}
              onClick={() => setDegreeFilter("all")}
            >
              All ({collaborators.length})
            </Badge>
            <Badge
              variant="outline"
              className={`cursor-pointer transition-all ${
                degreeFilter === 1
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20"
                  : "border-white/10 hover:border-white/20"
              }`}
              onClick={() => setDegreeFilter(1)}
            >
              1st Degree ({firstDegree.length})
            </Badge>
            <Badge
              variant="outline"
              className={`cursor-pointer transition-all ${
                degreeFilter === 2
                  ? "border-gray-500/30 bg-gray-500/10 text-gray-300 ring-1 ring-gray-500/20"
                  : "border-white/10 hover:border-white/20"
              }`}
              onClick={() => setDegreeFilter(2)}
            >
              2nd Degree ({secondDegree.length})
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Click on any node to view their GitHub profile
        </p>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-b border-white/5 flex flex-wrap gap-x-6 gap-y-2 text-xs">
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground font-medium">Connection Type:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0.5 bg-purple-500 rounded" />
            <span className="text-muted-foreground">Organization</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0.5 bg-cyan-500 rounded" />
            <span className="text-muted-foreground">Contributor</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0.5 bg-emerald-500 rounded" />
            <span className="text-muted-foreground">Mutual</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0.5 bg-blue-500 rounded" />
            <span className="text-muted-foreground">Following</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0.5 bg-amber-500 rounded" />
            <span className="text-muted-foreground">Follower</span>
          </div>
        </div>
      </div>

      {/* Graph */}
      <div className="h-[700px] bg-background/50 relative">
        {/* Concentric circle guides */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="absolute w-[400px] h-[400px] rounded-full border border-emerald-500/20" />
          <div className="absolute w-[760px] h-[760px] rounded-full border border-gray-500/10" />
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#333" gap={20} />
          <Controls
            showInteractive={false}
            className="!bg-white/10 !border-white/10 !shadow-none [&>button]:!bg-white/10 [&>button]:!border-white/10 [&>button]:!text-white [&>button:hover]:!bg-white/20"
          />
          <MiniMap
            nodeColor={(node) => {
              if (node.id === profile.login) return "#10b981";
              const degree = node.data?.degree as number;
              if (degree === 2) return "#6b7280";
              const type = node.data?.type as string;
              switch (type) {
                case "org": return "#a855f7";
                case "contributor": return "#06b6d4";
                case "following": return "#3b82f6";
                case "follower": return "#f59e0b";
                default: return "#6b7280";
              }
            }}
            maskColor="rgba(0, 0, 0, 0.8)"
            className="!bg-white/5 !border-white/10"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
