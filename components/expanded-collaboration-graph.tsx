"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  ConnectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import * as d3 from "d3";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Star, GitFork } from "lucide-react";
import { fetchUserCollaboration, type CollaborationData, type GitHubProfile } from "@/lib/actions/github-analyze";

interface ExpandedCollaborationGraphProps {
  profile: GitHubProfile;
  collaboration: CollaborationData;
  fullscreen?: boolean;
}

// D3 force simulation node type
interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  type: string;
  isCenter?: boolean;
}


interface UserState {
  profile: GitHubProfile;
  collaboration: CollaborationData;
}

// Custom node component for user avatars
function UserNode({ data }: { data: { label: string; avatar: string; isCenter?: boolean; type?: string; relationship?: string; isSelected?: boolean; isFaded?: boolean; orgs?: Array<{ login: string; avatar_url: string }> } }) {
  const getBorderColor = () => {
    if (data.isSelected) return "border-white ring-4 ring-white/40";
    if (data.isCenter) return "border-emerald-500 ring-4 ring-emerald-500/30";
    return "border-cyan-500";
  };

  const getSize = () => {
    if (data.isCenter || data.isSelected) return "w-24 h-24";
    return "w-14 h-14";
  };

  const size = data.isCenter || data.isSelected ? 96 : 56;

  return (
    <div className={`flex flex-col items-center gap-1 group cursor-pointer relative transition-opacity duration-300 ${data.isFaded ? "opacity-30" : "opacity-100"}`}>
      {/* Single centered handle that works for both source and target */}
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
          <div className="absolute -right-2 -top-1 flex flex-col gap-0.5">
            {data.orgs.slice(0, 3).map((org) => (
              <div
                key={org.login}
                className="w-5 h-5 rounded-full border border-purple-500 overflow-hidden bg-background"
                title={org.login}
              >
                <img
                  src={org.avatar_url}
                  alt={org.login}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
            {data.orgs.length > 3 && (
              <div className="w-5 h-5 rounded-full border border-purple-500/50 bg-purple-500/20 flex items-center justify-center text-[8px] text-purple-300">
                +{data.orgs.length - 3}
              </div>
            )}
          </div>
        )}
      </div>
      <span
        className={`text-xs ${
          data.isSelected ? "font-bold text-white" : data.isCenter ? "font-bold text-white" : "font-medium text-white/90"
        } max-w-[80px] truncate text-center`}
      >
        {data.label}
      </span>
    </div>
  );
}

// Custom node component for repository nodes
function RepoNodeComponent({ data }: { data: { label: string; fullName: string; description: string | null; stars: number; language: string | null; isFork?: boolean; isFaded?: boolean } }) {
  // Different styling for forks vs original repos
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

      <div className={`rounded-lg border-2 ${borderColor} bg-background px-3 py-2 min-w-[80px] max-w-[140px] transition-all group-hover:scale-105 ${hoverBorderColor}`}>
        <div className="flex items-center gap-1.5 mb-1">
          <GitFork className={`h-3 w-3 ${iconColor} flex-shrink-0`} />
          <span className="text-xs font-medium text-white truncate">{data.label}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {data.isFork && (
            <span className="text-slate-400 italic">fork</span>
          )}
          {data.stars > 0 && (
            <span className="flex items-center gap-0.5">
              <Star className="h-2.5 w-2.5 text-yellow-400" />
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

// Inner component that uses useReactFlow (must be inside ReactFlowProvider)
function CollaborationGraphInner({
  currentUser,
  history,
  onNavigateToUser,
  onGoBack,
  isLoading,
  fullscreen,
}: {
  currentUser: UserState;
  history: UserState[];
  onNavigateToUser: (username: string) => void;
  onGoBack: () => void;
  isLoading: boolean;
  fullscreen: boolean;
}) {
  const { profile, collaboration } = currentUser;
  const { collaborators, connections, repos, organizations } = collaboration;
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const { fitView } = useReactFlow();

  // Filter out org type collaborators - we show orgs as badges instead
  const nonOrgCollaborators = useMemo(() =>
    collaborators.filter(c => c.type !== "org"),
    [collaborators]
  );

  // Get connected nodes for the selected node (including through repos)
  const connectedNodeIds = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    const connected = new Set<string>();
    connected.add(selectedNode);

    // First pass: direct connections
    connections.forEach(conn => {
      if (conn.source === selectedNode) connected.add(conn.target);
      if (conn.target === selectedNode) connected.add(conn.source);
    });

    // Second pass: if a repo is connected, include its other connections too
    connections.forEach(conn => {
      if (connected.has(conn.source) && conn.source.startsWith('repo:')) {
        connected.add(conn.target);
      }
      if (connected.has(conn.target) && conn.target.startsWith('repo:')) {
        connected.add(conn.source);
      }
    });

    return connected;
  }, [selectedNode, connections]);

  // D3 force simulation state - Obsidian-style continuous simulation
  const simulationRef = useRef<d3.Simulation<SimNode, undefined> | null>(null);
  const simNodesRef = useRef<SimNode[]>([]);
  const [simulatedPositions, setSimulatedPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const isDraggingRef = useRef<string | null>(null);

  // Build graph data structure for D3
  const graphData = useMemo(() => {
    const centerX = 450;
    const centerY = 350;

    // Create D3 nodes - Obsidian style: no fixed positions, everything floats
    const d3Nodes: SimNode[] = [];

    // Center node - slightly heavier but still movable
    d3Nodes.push({
      id: profile.login,
      type: "user",
      isCenter: true,
      x: centerX,
      y: centerY,
    });

    // Repo nodes - cluster closer to center
    repos.forEach((repo, i) => {
      const angle = (2 * Math.PI * i) / Math.max(repos.length, 1);
      d3Nodes.push({
        id: `repo:${repo.full_name}`,
        type: "repo",
        x: centerX + Math.cos(angle) * 150 + (Math.random() - 0.5) * 50,
        y: centerY + Math.sin(angle) * 150 + (Math.random() - 0.5) * 50,
      });
    });

    // Collaborator nodes - spread out organically
    nonOrgCollaborators.forEach((collab, i) => {
      const angle = (2 * Math.PI * i) / Math.max(nonOrgCollaborators.length, 1);
      const radius = 250 + (Math.random() * 100);
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
  }, [profile.login, repos, nonOrgCollaborators, connections]);

  // Run D3 force simulation - Obsidian-style continuous physics
  useEffect(() => {
    // Stop any existing simulation
    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    const { nodes, links } = graphData;
    if (nodes.length === 0) return;

    // Create a deep copy of nodes for the simulation
    const simNodes = nodes.map(n => ({ ...n }));
    simNodesRef.current = simNodes;

    // Obsidian-style force simulation - softer, more organic
    const simulation = d3.forceSimulation<SimNode>(simNodes)
      // Link force - elastic connections like springs
      .force("link", d3.forceLink<SimNode, d3.SimulationLinkDatum<SimNode>>(links)
        .id((d) => d.id)
        .distance((link) => {
          const source = link.source as SimNode;
          const target = link.target as SimNode;
          // Longer distances for better spacing
          if (source.isCenter || target.isCenter) return 200; // Center to repo
          if (source.type === "repo" || target.type === "repo") return 180; // Repo to collaborator
          return 250; // Default
        })
        .strength(0.4)) // Slightly stronger for better structure
      // Charge force - nodes repel each other more
      .force("charge", d3.forceManyBody<SimNode>()
        .strength((d) => {
          if (d.isCenter) return -800; // Strong repulsion from center
          if (d.type === "repo") return -400;
          return -300; // Stronger repulsion for spacing
        })
        .distanceMax(600)) // Larger repulsion range
      // Collision - prevent overlapping with more space
      .force("collision", d3.forceCollide<SimNode>()
        .radius((d) => {
          if (d.isCenter) return 80;
          if (d.type === "repo") return 70;
          return 60;
        })
        .strength(0.8))
      // Gentle centering force - keeps graph from drifting away
      .force("center", d3.forceCenter(450, 350).strength(0.03))
      // Very gentle x/y positioning to prevent extreme drift
      .force("x", d3.forceX(450).strength(0.01))
      .force("y", d3.forceY(350).strength(0.01))
      // Velocity decay - how quickly nodes slow down (lower = more floaty)
      .velocityDecay(0.4)
      // Alpha decay - how quickly simulation settles (lower = longer animation)
      .alphaDecay(0.01)
      // Minimum alpha - simulation keeps running gently
      .alphaMin(0.001)
      .alphaTarget(0.02); // Keep a tiny bit of movement always (Obsidian-style)

    simulationRef.current = simulation;

    // Update positions on each tick
    simulation.on("tick", () => {
      const positions = new Map<string, { x: number; y: number }>();
      simNodes.forEach((node) => {
        positions.set(node.id, { x: node.x || 450, y: node.y || 350 });
      });
      setSimulatedPositions(new Map(positions));
    });

    // Start simulation
    simulation.alpha(1).restart();

    return () => {
      simulation.stop();
    };
  }, [graphData]);

  // Handle node drag - Obsidian-style interactive dragging
  const onNodeDragStart = useCallback((_event: React.MouseEvent, node: Node) => {
    isDraggingRef.current = node.id;
    const simNode = simNodesRef.current.find(n => n.id === node.id);
    if (simNode && simulationRef.current) {
      // Fix the node position while dragging
      simNode.fx = simNode.x;
      simNode.fy = simNode.y;
      // Reheat the simulation for responsive dragging
      simulationRef.current.alphaTarget(0.3).restart();
    }
  }, []);

  const onNodeDrag = useCallback((_event: React.MouseEvent, node: Node) => {
    const simNode = simNodesRef.current.find(n => n.id === node.id);
    if (simNode) {
      // Update fixed position to follow drag
      simNode.fx = node.position.x;
      simNode.fy = node.position.y;
    }
  }, []);

  const onNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
    isDraggingRef.current = null;
    const simNode = simNodesRef.current.find(n => n.id === node.id);
    if (simNode && simulationRef.current) {
      // Release the node - let it float again
      simNode.fx = null;
      simNode.fy = null;
      // Cool down the simulation gradually
      simulationRef.current.alphaTarget(0.02);
    }
  }, []);

  // Generate edges only once (not dependent on positions)
  const graphEdges = useMemo(() => {
    const edges: Edge[] = [];
    const nodeIds = new Set<string>();

    // Collect all node IDs
    nodeIds.add(profile.login);
    repos.forEach(repo => nodeIds.add(`repo:${repo.full_name}`));
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
            strokeWidth: 2,
          },
        });
      }
    });

    return edges;
  }, [profile.login, repos, nonOrgCollaborators, connections]);

  // Generate React Flow nodes using simulated positions
  const initialNodes = useMemo(() => {
    const nodes: Node[] = [];
    const centerX = 450;
    const centerY = 350;

    // Check if node should be faded (when there's a selection and it's not connected)
    const shouldFade = (nodeId: string) => {
      if (!selectedNode) return false;
      return !connectedNodeIds.has(nodeId);
    };

    // Initial positions - will be updated by D3 simulation via useEffect
    const getPosition = (_nodeId: string, defaultX: number, defaultY: number) => {
      return { x: defaultX, y: defaultY };
    };

    // Center node (the profile being analyzed) - with org badges
    const centerPos = getPosition(profile.login, centerX, centerY);
    nodes.push({
      id: profile.login,
      type: "userNode",
      position: centerPos,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      data: {
        label: profile.login,
        avatar: profile.avatar_url,
        isCenter: true,
        isSelected: selectedNode === profile.login,
        isFaded: shouldFade(profile.login),
        orgs: organizations,
      },
    });

    // Repo nodes
    repos.forEach((repo) => {
      const nodeId = `repo:${repo.full_name}`;
      const pos = getPosition(nodeId, centerX, centerY);

      nodes.push({
        id: nodeId,
        type: "repoNode",
        position: pos,
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        data: {
          label: repo.name,
          fullName: repo.full_name,
          description: repo.description,
          stars: repo.stars,
          language: repo.language,
          isFork: repo.isFork,
          isFaded: shouldFade(nodeId),
        },
      });
    });

    // Collaborator nodes
    nonOrgCollaborators.forEach((collab) => {
      const pos = getPosition(collab.login, centerX, centerY);

      nodes.push({
        id: collab.login,
        type: "userNode",
        position: pos,
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        data: {
          label: collab.login,
          avatar: collab.avatar_url,
          type: collab.type,
          relationship: collab.relationship,
          isSelected: selectedNode === collab.login,
          isFaded: shouldFade(collab.login),
        },
      });
    });

    return nodes;
  }, [profile, nonOrgCollaborators, repos, organizations, selectedNode, connectedNodeIds]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges] = useEdgesState(graphEdges);

  // Update node positions without replacing the entire nodes array
  // This prevents React Flow from clearing edges
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

  // Only update edges when the graph structure changes (new user/data)
  useEffect(() => {
    setEdges(graphEdges);
  }, [graphEdges, setEdges]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    // If clicking the center node, do nothing
    if (node.id === profile.login) {
      return;
    }

    // Immediately navigate to the clicked user's network
    onNavigateToUser(node.id);
  }, [profile.login, onNavigateToUser]);

  const onPaneClick = useCallback(() => {
    if (selectedNode) {
      setSelectedNode(null);
      setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 50);
    }
  }, [selectedNode, fitView]);

  return (
    <div className={fullscreen ? "h-full w-full flex flex-col" : "rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden"}>
      {/* Header with navigation */}
      <div className={`px-4 py-3 border-b border-white/5 flex flex-wrap items-center justify-between gap-4 ${fullscreen ? "bg-background/80 backdrop-blur-xl" : ""}`}>
        <div className="flex items-center gap-4">
          {/* Back button and breadcrumb */}
          {history.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onGoBack}
              disabled={isLoading}
              className="gap-2 text-muted-foreground hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          )}

          {/* Current user indicator */}
          <div className="flex items-center gap-2">
            <img
              src={profile.avatar_url}
              alt={profile.login}
              className="w-6 h-6 rounded-full border border-white/10"
            />
            <span className="font-medium text-white">@{profile.login}</span>
            {history.length > 0 && (
              <span className="text-xs text-muted-foreground">
                ({history.length} {history.length === 1 ? "step" : "steps"} deep)
              </span>
            )}
          </div>

          <div className="h-4 w-px bg-white/10" />

          <Badge variant="outline" className="border-white/10">
            {nonOrgCollaborators.length} collaborators
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading network...
            </span>
          ) : (
            "Click on any user to explore their network"
          )}
        </p>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-b border-white/5 flex flex-wrap gap-x-6 gap-y-2 text-xs">
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground font-medium">Nodes:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border-2 border-emerald-500" />
            <span className="text-muted-foreground">Center User</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded border-2 border-amber-500" />
            <span className="text-muted-foreground">Repository</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded border-2 border-slate-500" />
            <span className="text-muted-foreground">Fork</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border-2 border-cyan-500" />
            <span className="text-muted-foreground">Contributor</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full border border-purple-500" />
            <span className="text-muted-foreground">Org badge</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground font-medium">Edges:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0.5 bg-amber-500 rounded" />
            <span className="text-muted-foreground">User → Repo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0.5 bg-cyan-500 rounded" />
            <span className="text-muted-foreground">Repo → Contributor</span>
          </div>
        </div>
      </div>

      {/* Graph - Obsidian-style dark canvas */}
      <div className={fullscreen ? "flex-1 bg-[#1a1a2e] relative" : "h-[700px] bg-[#1a1a2e] relative"}>
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-[#1a1a2e]/90 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              <span className="text-sm text-muted-foreground">Loading network...</span>
            </div>
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onNodeClick={onNodeClick}
          onNodeDragStart={onNodeDragStart}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={{
            style: { stroke: '#06b6d4', strokeWidth: 2 },
            animated: false,
          }}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          connectionMode={ConnectionMode.Loose}
        >
          <Background color="#2a2a4a" gap={25} variant={BackgroundVariant.Dots} size={1} />
          <Controls
            showInteractive={false}
            className="!bg-white/10 !border-white/10 !shadow-none [&>button]:!bg-white/10 [&>button]:!border-white/10 [&>button]:!text-white [&>button:hover]:!bg-white/20"
          />
          <MiniMap
            nodeColor={(node) => {
              if (node.id === profile.login) return "#10b981";
              // Repo nodes
              if (node.id.startsWith('repo:')) return "#f59e0b";
              // All collaborators are contributors (orgs shown as badges)
              return "#06b6d4";
            }}
            maskColor="rgba(0, 0, 0, 0.8)"
            className="!bg-white/5 !border-white/10"
          />
        </ReactFlow>
      </div>
    </div>
  );
}

// Exported wrapper component with ReactFlowProvider and state management
export function ExpandedCollaborationGraph({ profile, collaboration, fullscreen = false }: ExpandedCollaborationGraphProps) {
  const [isPending, startTransition] = useTransition();

  // Navigation state
  const [currentUser, setCurrentUser] = useState<UserState>({ profile, collaboration });
  const [history, setHistory] = useState<UserState[]>([]);

  const handleNavigateToUser = useCallback((username: string) => {
    startTransition(async () => {
      try {
        const data = await fetchUserCollaboration(username);
        // Save current state to history
        setHistory(prev => [...prev, currentUser]);
        // Navigate to new user
        setCurrentUser(data);
      } catch (error) {
        console.error("Failed to fetch user collaboration:", error);
      }
    });
  }, [currentUser]);

  const handleGoBack = useCallback(() => {
    if (history.length > 0) {
      const previousUser = history[history.length - 1];
      setHistory(prev => prev.slice(0, -1));
      setCurrentUser(previousUser);
    }
  }, [history]);

  if (currentUser.collaboration.collaborators.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-12 text-center">
        <p className="text-muted-foreground">No collaboration data available for this user.</p>
        {history.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleGoBack}
            className="mt-4 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
        )}
      </div>
    );
  }

  return (
    <ReactFlowProvider key={currentUser.profile.login}>
      <CollaborationGraphInner
        currentUser={currentUser}
        history={history}
        onNavigateToUser={handleNavigateToUser}
        onGoBack={handleGoBack}
        isLoading={isPending}
        fullscreen={fullscreen}
      />
    </ReactFlowProvider>
  );
}
