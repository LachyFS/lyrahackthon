"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Background,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Star, GitFork } from "lucide-react";
import { fetchUserCollaboration, type CollaborationData, type GitHubProfile } from "@/lib/actions/github-analyze";

interface ExpandedCollaborationGraphProps {
  profile: GitHubProfile;
  collaboration: CollaborationData;
  fullscreen?: boolean;
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
  const handleOffset = size / 2;

  return (
    <div className={`flex flex-col items-center gap-1 group cursor-pointer relative transition-opacity duration-300 ${data.isFaded ? "opacity-30" : "opacity-100"}`}>
      {/* Centered handle for edge connections */}
      <Handle
        type="source"
        position={Position.Top}
        id="center-source"
        style={{
          background: 'transparent',
          border: 'none',
          top: handleOffset,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 1,
          height: 1,
        }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="center-target"
        style={{
          background: 'transparent',
          border: 'none',
          top: handleOffset,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 1,
          height: 1,
        }}
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
function RepoNodeComponent({ data }: { data: { label: string; fullName: string; description: string | null; stars: number; language: string | null; isFaded?: boolean } }) {
  const handleOffset = 24; // Half of the node height

  return (
    <div className={`flex flex-col items-center gap-1 group cursor-pointer relative transition-opacity duration-300 ${data.isFaded ? "opacity-30" : "opacity-100"}`}>
      {/* Centered handle for edge connections */}
      <Handle
        type="source"
        position={Position.Top}
        id="center-source"
        style={{
          background: 'transparent',
          border: 'none',
          top: handleOffset,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 1,
          height: 1,
        }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="center-target"
        style={{
          background: 'transparent',
          border: 'none',
          top: handleOffset,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 1,
          height: 1,
        }}
      />

      <div className="rounded-lg border-2 border-amber-500/70 bg-background px-3 py-2 min-w-[80px] max-w-[140px] transition-all group-hover:scale-105 group-hover:border-amber-400">
        <div className="flex items-center gap-1.5 mb-1">
          <GitFork className="h-3 w-3 text-amber-400 flex-shrink-0" />
          <span className="text-xs font-medium text-white truncate">{data.label}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
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

  // Generate nodes and edges based on connections data
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const centerX = 450;
    const centerY = 350;

    // Check if node should be faded (when there's a selection and it's not connected)
    const shouldFade = (nodeId: string) => {
      if (!selectedNode) return false;
      return !connectedNodeIds.has(nodeId);
    };

    // Center node (the profile being analyzed) - with org badges
    nodes.push({
      id: profile.login,
      type: "userNode",
      position: { x: centerX, y: centerY },
      data: {
        label: profile.login,
        avatar: profile.avatar_url,
        isCenter: true,
        isSelected: selectedNode === profile.login,
        isFaded: shouldFade(profile.login),
        orgs: organizations,
      },
    });

    // Position repo nodes in an inner ring (between center and contributors)
    const repoRadius = 130;

    if (repos.length > 0) {
      const repoAngleStep = (2 * Math.PI) / repos.length;
      repos.forEach((repo, index) => {
        const angle = repoAngleStep * index - Math.PI / 2; // Start from top
        const x = centerX + repoRadius * Math.cos(angle);
        const y = centerY + repoRadius * Math.sin(angle);
        const nodeId = `repo:${repo.full_name}`;

        nodes.push({
          id: nodeId,
          type: "repoNode",
          position: { x, y },
          data: {
            label: repo.name,
            fullName: repo.full_name,
            description: repo.description,
            stars: repo.stars,
            language: repo.language,
            isFaded: shouldFade(nodeId),
          },
        });
      });
    }

    // Group collaborators by type for better organization
    const typeOrder: Array<"contributor" | "following" | "follower"> = ["contributor", "following", "follower"];
    const groupedCollabs = typeOrder.map(type => nonOrgCollaborators.filter(c => c.type === type));

    // Calculate segment angles for each type group
    const totalCollabs = nonOrgCollaborators.length;
    const baseRadius = 280; // Pushed out to make room for repos

    // Position collaborators in segments by type (like a pie chart)
    let currentAngle = -Math.PI / 2; // Start from top

    groupedCollabs.forEach((group) => {
      if (group.length === 0) return;

      // Each group gets proportional space
      const groupAngle = (group.length / Math.max(totalCollabs, 1)) * 2 * Math.PI;
      const spacing = groupAngle / (group.length + 1);

      group.forEach((collab, index) => {
        const angle = currentAngle + spacing * (index + 1);
        // Vary radius slightly for visual interest
        const radiusVariation = (index % 2 === 0) ? 0 : 20;
        const radius = baseRadius + radiusVariation;
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
            relationship: collab.relationship,
            isSelected: selectedNode === collab.login,
            isFaded: shouldFade(collab.login),
          },
        });
      });

      currentAngle += groupAngle;
    });

    // Create edges from connections data (skip org connections - orgs shown as badges)
    const nodeIds = new Set(nodes.map(n => n.id));

    connections.forEach((conn, index) => {
      // Skip org connections - we show orgs as badges instead
      if (conn.type === "org") return;

      // Only create edge if both nodes exist in our filtered view
      if (nodeIds.has(conn.source) && nodeIds.has(conn.target)) {
        let edgeColor = "#06b6d4"; // Default cyan for contributors
        let strokeWidth = 1.5;
        const opacity = 1;

        // Determine edge styling based on connection type
        const isRepoConnection = conn.source.startsWith('repo:') || conn.target.startsWith('repo:');

        if (conn.type === "repo") {
          // User to repo connection
          edgeColor = "#f59e0b"; // Amber for repo connections
          strokeWidth = 2;
        } else if (conn.type === "contributor" && isRepoConnection) {
          // Repo to contributor connection
          edgeColor = "#06b6d4"; // Cyan
          strokeWidth = 1.5;
        }

        // Fade edges that aren't connected to the selected node
        const isConnectedToSelected = selectedNode && (conn.source === selectedNode || conn.target === selectedNode);
        const edgeOpacity = selectedNode ? (isConnectedToSelected ? opacity : 0.1) : opacity;

        edges.push({
          id: `edge-${index}-${conn.source}-${conn.target}`,
          source: conn.source,
          target: conn.target,
          sourceHandle: "center-source",
          targetHandle: "center-target",
          type: "straight",
          style: { stroke: edgeColor, strokeWidth, opacity: edgeOpacity, transition: "opacity 0.3s" },
        });
      }
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [profile, nonOrgCollaborators, connections, repos, organizations, selectedNode, connectedNodeIds]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes and edges when selection or filter changes
  // (user changes are handled by key-based remounting)
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

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

      {/* Graph */}
      <div className={fullscreen ? "flex-1 bg-background/50 relative" : "h-[700px] bg-background/50 relative"}>
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              <span className="text-sm text-muted-foreground">Loading network...</span>
            </div>
          </div>
        )}

        {/* Concentric circle guides */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="absolute w-[260px] h-[260px] rounded-full border border-amber-500/20" />
          <div className="absolute w-[560px] h-[560px] rounded-full border border-cyan-500/15" />
          <div className="absolute w-[900px] h-[900px] rounded-full border border-gray-500/10" />
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          connectionMode={ConnectionMode.Loose}
          defaultEdgeOptions={{ type: "straight" }}
        >
          <Background color="#333" gap={20} />
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
