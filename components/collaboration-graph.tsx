"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  Handle,
  Position,
  ConnectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import * as d3 from "d3";
import { Button } from "@/components/ui/button";
import { Maximize2, GitFork, Star } from "lucide-react";
import type { CollaborationData, GitHubProfile } from "@/lib/actions/github-analyze";

interface CollaborationGraphProps {
  profile: GitHubProfile;
  collaboration: CollaborationData;
}

// D3 force simulation node type
interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  type: string;
  isCenter?: boolean;
}

// Custom node component for user avatars
function UserNode({ data }: { data: { label: string; avatar: string; isCenter?: boolean; type?: string; isFaded?: boolean; orgs?: Array<{ login: string; avatar_url: string }> } }) {
  const getBorderColor = () => {
    if (data.isCenter) return "border-emerald-500 ring-2 ring-emerald-500/30";
    return "border-cyan-500";
  };

  const getSize = () => {
    if (data.isCenter) return "w-14 h-14";
    return "w-10 h-10";
  };

  const size = data.isCenter ? 56 : 40;

  return (
    <div className={`flex flex-col items-center gap-1 group cursor-pointer relative transition-opacity duration-300 ${data.isFaded ? "opacity-30" : "opacity-100"}`}>
      {/* Centered handles for edge connections */}
      <Handle
        type="source"
        position={Position.Top}
        style={{
          position: 'absolute',
          top: size / 2,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'transparent',
          border: 'none',
          width: 10,
          height: 10,
        }}
        isConnectable={false}
      />
      <Handle
        type="target"
        position={Position.Top}
        style={{
          position: 'absolute',
          top: size / 2,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'transparent',
          border: 'none',
          width: 10,
          height: 10,
        }}
        isConnectable={false}
      />

      <div className="relative">
        <div
          className={`rounded-full border-2 ${getBorderColor()} overflow-hidden ${getSize()} bg-background transition-all group-hover:scale-110 group-hover:z-10`}
        >
          <img
            src={data.avatar}
            alt={data.label}
            className="w-full h-full object-cover"
          />
        </div>
        {/* Organization badges next to user avatar */}
        {data.orgs && data.orgs.length > 0 && (
          <div className="absolute -right-1 -top-0.5 flex flex-col gap-0.5">
            {data.orgs.slice(0, 2).map((org) => (
              <div
                key={org.login}
                className="w-4 h-4 rounded-full border border-purple-500 overflow-hidden bg-background"
                title={org.login}
              >
                <img
                  src={org.avatar_url}
                  alt={org.login}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
            {data.orgs.length > 2 && (
              <div className="w-4 h-4 rounded-full border border-purple-500/50 bg-purple-500/20 flex items-center justify-center text-[7px] text-purple-300">
                +{data.orgs.length - 2}
              </div>
            )}
          </div>
        )}
      </div>
      <span
        className={`text-[10px] ${
          data.isCenter ? "font-bold text-white" : "font-medium text-white/90"
        } max-w-[60px] truncate text-center`}
      >
        {data.label}
      </span>
    </div>
  );
}

// Custom node component for repository nodes
function RepoNodeComponent({ data }: { data: { label: string; stars: number; language: string | null; isFork?: boolean; isFaded?: boolean } }) {
  const borderColor = data.isFork ? "border-slate-500/70" : "border-amber-500/70";
  const hoverBorderColor = data.isFork ? "group-hover:border-slate-400" : "group-hover:border-amber-400";
  const iconColor = data.isFork ? "text-slate-400" : "text-amber-400";

  return (
    <div className={`flex flex-col items-center gap-1 group cursor-pointer relative transition-opacity duration-300 ${data.isFaded ? "opacity-30" : "opacity-100"}`}>
      {/* Centered handles for edge connections */}
      <Handle
        type="source"
        position={Position.Top}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'transparent',
          border: 'none',
          width: 10,
          height: 10,
        }}
        isConnectable={false}
      />
      <Handle
        type="target"
        position={Position.Top}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'transparent',
          border: 'none',
          width: 10,
          height: 10,
        }}
        isConnectable={false}
      />

      <div className={`rounded-lg border-2 ${borderColor} bg-background px-2 py-1.5 min-w-[60px] max-w-[100px] transition-all group-hover:scale-105 ${hoverBorderColor}`}>
        <div className="flex items-center gap-1 mb-0.5">
          <GitFork className={`h-2.5 w-2.5 ${iconColor} flex-shrink-0`} />
          <span className="text-[10px] font-medium text-white truncate">{data.label}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[8px] text-muted-foreground">
          {data.isFork && (
            <span className="text-slate-400 italic">fork</span>
          )}
          {data.stars > 0 && (
            <span className="flex items-center gap-0.5">
              <Star className="h-2 w-2 text-yellow-400" />
              {data.stars}
            </span>
          )}
          {data.language && (
            <span className="truncate">{data.language}</span>
          )}
        </div>
      </div>
    </div>
  );
}

const nodeTypes = {
  userNode: UserNode,
  repoNode: RepoNodeComponent,
};

// Inner component that uses ReactFlow hooks
function CollaborationGraphInner({ profile, collaboration }: CollaborationGraphProps) {
  const { collaborators, connections, repos, organizations } = collaboration;

  // Filter out org type collaborators - we show orgs as badges instead
  const nonOrgCollaborators = useMemo(() =>
    collaborators.filter(c => c.type !== "org").slice(0, 8), // Limit for compact view
    [collaborators]
  );

  // Limit repos for compact view
  const limitedRepos = useMemo(() => repos.slice(0, 4), [repos]);

  // D3 force simulation state
  const simulationRef = useRef<d3.Simulation<SimNode, undefined> | null>(null);
  const simNodesRef = useRef<SimNode[]>([]);
  const [simulatedPositions, setSimulatedPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const isDraggingRef = useRef<string | null>(null);

  // Build graph data structure for D3
  const graphData = useMemo(() => {
    const centerX = 300;
    const centerY = 200;

    const d3Nodes: SimNode[] = [];

    // Center node
    d3Nodes.push({
      id: profile.login,
      type: "user",
      isCenter: true,
      x: centerX,
      y: centerY,
    });

    // Repo nodes - cluster closer to center
    limitedRepos.forEach((repo, i) => {
      const angle = (2 * Math.PI * i) / Math.max(limitedRepos.length, 1);
      d3Nodes.push({
        id: `repo:${repo.full_name}`,
        type: "repo",
        x: centerX + Math.cos(angle) * 100 + (Math.random() - 0.5) * 30,
        y: centerY + Math.sin(angle) * 100 + (Math.random() - 0.5) * 30,
      });
    });

    // Collaborator nodes
    nonOrgCollaborators.forEach((collab, i) => {
      const angle = (2 * Math.PI * i) / Math.max(nonOrgCollaborators.length, 1);
      const radius = 160 + (Math.random() * 40);
      d3Nodes.push({
        id: collab.login,
        type: "collaborator",
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      });
    });

    // Create D3 links from connections
    const nodeIds = new Set(d3Nodes.map(n => n.id));
    const d3Links: Array<d3.SimulationLinkDatum<SimNode>> = [];

    connections.forEach((conn) => {
      if (conn.type === "org") return;
      if (nodeIds.has(conn.source) && nodeIds.has(conn.target)) {
        d3Links.push({
          source: conn.source,
          target: conn.target,
        });
      }
    });

    return { nodes: d3Nodes, links: d3Links };
  }, [profile.login, limitedRepos, nonOrgCollaborators, connections]);

  // Run D3 force simulation
  useEffect(() => {
    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    const { nodes, links } = graphData;
    if (nodes.length === 0) return;

    const simNodes = nodes.map(n => ({ ...n }));
    simNodesRef.current = simNodes;

    const simulation = d3.forceSimulation<SimNode>(simNodes)
      .force("link", d3.forceLink<SimNode, d3.SimulationLinkDatum<SimNode>>(links)
        .id((d) => d.id)
        .distance((link) => {
          const source = link.source as SimNode;
          const target = link.target as SimNode;
          if (source.isCenter || target.isCenter) return 120;
          if (source.type === "repo" || target.type === "repo") return 100;
          return 140;
        })
        .strength(0.6))
      .force("charge", d3.forceManyBody<SimNode>()
        .strength((d) => {
          if (d.isCenter) return -400;
          if (d.type === "repo") return -200;
          return -150;
        })
        .distanceMax(300))
      .force("collision", d3.forceCollide<SimNode>()
        .radius((d) => {
          if (d.isCenter) return 40;
          if (d.type === "repo") return 35;
          return 30;
        })
        .strength(0.7))
      .force("center", d3.forceCenter(300, 200).strength(0.05))
      .velocityDecay(0.6)
      .alphaDecay(0.05)
      .alphaMin(0.01)
      .alphaTarget(0);

    simulationRef.current = simulation;

    let tickCount = 0;
    simulation.on("tick", () => {
      tickCount++;
      if (tickCount % 2 !== 0 && simulation.alpha() > 0.1) return;

      const positions = new Map<string, { x: number; y: number }>();
      simNodes.forEach((node) => {
        positions.set(node.id, { x: node.x || 300, y: node.y || 200 });
      });
      setSimulatedPositions(positions);
    });

    simulation.alpha(0.8).restart();

    return () => {
      simulation.stop();
    };
  }, [graphData]);

  // Handle node drag
  const onNodeDragStart = useCallback((_event: React.MouseEvent, node: Node) => {
    isDraggingRef.current = node.id;
    const simNode = simNodesRef.current.find(n => n.id === node.id);
    if (simNode && simulationRef.current) {
      simNode.fx = simNode.x;
      simNode.fy = simNode.y;
      simulationRef.current.alphaTarget(0.1).restart();
    }
  }, []);

  const onNodeDrag = useCallback((_event: React.MouseEvent, node: Node) => {
    const simNode = simNodesRef.current.find(n => n.id === node.id);
    if (simNode) {
      simNode.fx = node.position.x;
      simNode.fy = node.position.y;
    }
  }, []);

  const onNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
    isDraggingRef.current = null;
    const simNode = simNodesRef.current.find(n => n.id === node.id);
    if (simNode && simulationRef.current) {
      simNode.fx = null;
      simNode.fy = null;
      simulationRef.current.alphaTarget(0);
    }
  }, []);

  // Generate edges
  const graphEdges = useMemo(() => {
    const edges: Edge[] = [];
    const nodeIds = new Set<string>();

    nodeIds.add(profile.login);
    limitedRepos.forEach(repo => nodeIds.add(`repo:${repo.full_name}`));
    nonOrgCollaborators.forEach(collab => nodeIds.add(collab.login));

    connections.forEach((conn, index) => {
      if (conn.type === "org") return;

      if (nodeIds.has(conn.source) && nodeIds.has(conn.target)) {
        let edgeColor = "#06b6d4";

        if (conn.type === "repo") {
          edgeColor = "#f59e0b";
        }

        edges.push({
          id: `edge-${index}-${conn.source}-${conn.target}`,
          source: conn.source,
          target: conn.target,
          type: 'straight',
          style: {
            stroke: edgeColor,
            strokeWidth: 1.5,
          },
        });
      }
    });

    return edges;
  }, [profile.login, limitedRepos, nonOrgCollaborators, connections]);

  // Generate React Flow nodes
  const initialNodes = useMemo(() => {
    const nodes: Node[] = [];
    const centerX = 300;
    const centerY = 200;

    // Center node with org badges
    nodes.push({
      id: profile.login,
      type: "userNode",
      position: { x: centerX, y: centerY },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      data: {
        label: profile.login,
        avatar: profile.avatar_url,
        isCenter: true,
        orgs: organizations,
      },
    });

    // Repo nodes
    limitedRepos.forEach((repo) => {
      const nodeId = `repo:${repo.full_name}`;
      nodes.push({
        id: nodeId,
        type: "repoNode",
        position: { x: centerX, y: centerY },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        data: {
          label: repo.name,
          stars: repo.stars,
          language: repo.language,
          isFork: repo.isFork,
        },
      });
    });

    // Collaborator nodes
    nonOrgCollaborators.forEach((collab) => {
      nodes.push({
        id: collab.login,
        type: "userNode",
        position: { x: centerX, y: centerY },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        data: {
          label: collab.login,
          avatar: collab.avatar_url,
          type: collab.type,
        },
      });
    });

    return nodes;
  }, [profile, nonOrgCollaborators, limitedRepos, organizations]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges] = useEdgesState(graphEdges);

  // Update node positions from D3 simulation
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        const simPos = simulatedPositions.get(node.id);
        if (simPos) {
          return {
            ...node,
            position: simPos,
          };
        }
        return node;
      })
    );
  }, [simulatedPositions, setNodes]);

  // Update edges when graph structure changes
  useEffect(() => {
    setEdges(graphEdges);
  }, [graphEdges, setEdges]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.id !== profile.login && !node.id.startsWith('repo:')) {
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
      <div className="px-4 py-2 border-b border-white/5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full border-2 border-emerald-500" />
          <span className="text-muted-foreground">Center</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded border-2 border-amber-500" />
          <span className="text-muted-foreground">Repo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full border-2 border-cyan-500" />
          <span className="text-muted-foreground">Contributor</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full border border-purple-500" />
          <span className="text-muted-foreground">Org</span>
        </div>
      </div>

      <div className="h-[400px] relative" style={{ background: 'radial-gradient(ellipse at center, #1a1a1a 0%, #0d0d0d 50%, #000000 100%)' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onNodeClick={onNodeClick}
          onNodeDragStart={onNodeDragStart}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={{
            style: { stroke: '#06b6d4', strokeWidth: 1.5 },
            animated: false,
          }}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.5}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          connectionMode={ConnectionMode.Loose}
        >
          <Background color="#2a2a2a" gap={20} variant={BackgroundVariant.Dots} size={1} />
          <Controls
            showInteractive={false}
            className="!bg-white/10 !border-white/10 !shadow-none [&>button]:!bg-white/10 [&>button]:!border-white/10 [&>button]:!text-white [&>button:hover]:!bg-white/20"
          />
        </ReactFlow>
      </div>
    </div>
  );
}

// Exported wrapper component with ReactFlowProvider
export function CollaborationGraph({ profile, collaboration }: CollaborationGraphProps) {
  return (
    <ReactFlowProvider>
      <CollaborationGraphInner profile={profile} collaboration={collaboration} />
    </ReactFlowProvider>
  );
}
