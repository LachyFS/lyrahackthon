"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Maximize2 } from "lucide-react";
import type { CollaborationData, GitHubProfile } from "@/lib/actions/github-analyze";

interface CollaborationGraphProps {
  profile: GitHubProfile;
  collaboration: CollaborationData;
}

// Custom node component for user avatars
function UserNode({ data }: { data: { label: string; avatar: string; isCenter?: boolean; type?: string; degree?: number } }) {
  const getBorderColor = () => {
    if (data.isCenter) return "border-emerald-500 ring-2 ring-emerald-500/30";
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
    if (data.isCenter) return "w-16 h-16";
    if (data.degree === 1) return "w-10 h-10";
    return "w-8 h-8";
  };

  return (
    <div className="flex flex-col items-center gap-1 relative">
      {/* Hidden handles for edge connections */}
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-1 !h-1" />
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-1 !h-1" />
      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0 !w-1 !h-1" />
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0 !w-1 !h-1" />

      <div
        className={`rounded-full border-2 ${getBorderColor()} overflow-hidden ${getSize()} bg-background`}
      >
        <img
          src={data.avatar}
          alt={data.label}
          className="w-full h-full object-cover"
        />
      </div>
      <span
        className={`text-xs ${
          data.isCenter ? "font-semibold text-white" : data.degree === 2 ? "text-white/50" : "text-muted-foreground"
        } max-w-[60px] truncate`}
      >
        {data.label}
      </span>
    </div>
  );
}

const nodeTypes = {
  userNode: UserNode,
};

export function CollaborationGraph({ profile, collaboration }: CollaborationGraphProps) {
  const { collaborators, connections } = collaboration;

  // Only show 1st degree connections in the small view
  const firstDegreeCollabs = collaborators.filter(c => c.degree === 1).slice(0, 12);

  // Generate nodes and edges
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const centerX = 300;
    const centerY = 200;

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

    // Position 1st degree collaborators in a circle
    const radius = 150;
    const angleStep = (2 * Math.PI) / Math.max(firstDegreeCollabs.length, 1);

    firstDegreeCollabs.forEach((collab, index) => {
      const angle = angleStep * index - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      nodes.push({
        id: collab.login,
        type: "userNode",
        position: { x, y },
        data: {
          label: collab.login,
          avatar: collab.avatar_url,
          type: collab.type,
          degree: 1,
        },
      });
    });

    // Create edges from connections data
    const nodeIds = new Set(nodes.map(n => n.id));

    connections.forEach((conn, index) => {
      if (nodeIds.has(conn.source) && nodeIds.has(conn.target)) {
        let edgeColor = "#6b7280";
        let strokeWidth = 1;
        let animated = false;

        switch (conn.type) {
          case "org":
            edgeColor = "#a855f7";
            strokeWidth = 2;
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

        edges.push({
          id: `edge-${index}-${conn.source}-${conn.target}`,
          source: conn.source,
          target: conn.target,
          type: "default",
          style: { stroke: edgeColor, strokeWidth },
          animated,
          markerEnd: conn.type === "follower" ? {
            type: MarkerType.ArrowClosed,
            color: edgeColor,
          } : undefined,
        });
      }
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [profile, firstDegreeCollabs, connections]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (node.id !== profile.login) {
      window.open(`https://github.com/${node.id}`, "_blank");
    }
  }, [profile.login]);

  const firstDegreeCount = collaborators.filter(c => c.degree === 1).length;
  const secondDegreeCount = collaborators.filter(c => c.degree === 2).length;

  if (collaborators.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center">
        <p className="text-muted-foreground">No collaboration data available</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white">Collaboration Network</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {firstDegreeCount} direct · {secondDegreeCount} extended connections
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/analyze/${profile.login}/network`}>
            <Maximize2 className="h-4 w-4 mr-2" />
            Expand
          </Link>
        </Button>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-b border-white/5 flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full border-2 border-purple-500" />
          <span className="text-muted-foreground">Org</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full border-2 border-cyan-500" />
          <span className="text-muted-foreground">Contributor</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full border-2 border-blue-500" />
          <span className="text-muted-foreground">Following</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full border-2 border-amber-500" />
          <span className="text-muted-foreground">Follower</span>
        </div>
      </div>

      <div className="h-[400px] bg-background/50">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.5}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#333" gap={20} />
          <Controls
            showInteractive={false}
            className="!bg-white/10 !border-white/10 !shadow-none [&>button]:!bg-white/10 [&>button]:!border-white/10 [&>button]:!text-white [&>button:hover]:!bg-white/20"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
