// src/components/WorkflowBuilder.tsx

"use client";
import React, { useEffect, useCallback, useRef } from "react";
import ReactFlow, { 
  addEdge, 
  Background, 
  Controls, 
  MiniMap, 
  Connection, 
  Node, 
  applyNodeChanges,
  NodeChange,
  Panel,
  Edge,
  EdgeTypes
} from "reactflow";
import "reactflow/dist/style.css";
import AITaskNode from "../components/nodes/AITaskNode";
import ConditionalEdge from "../components/ConditionalEdge";
// import AiNode from "./nodes/AiNode";
import { useWorkflowStore } from "../store/workflowStore";
import { Undo2, Redo2, Save } from "lucide-react";
import { toast } from 'react-toastify';
import WorkflowExecutionPanel from "./WorkflowExecutionPanel";

const nodeTypes = { aiTask: AITaskNode };
const edgeTypes: EdgeTypes = { conditional: ConditionalEdge };

const WorkflowBuilder: React.FC = () => {
  const { 
    nodes, 
    edges, 
    setNodes, 
    setEdges, 
    loadWorkflows, 
    user,
    undo,
    redo,
    saveWorkflow,
    workflowName
  } = useWorkflowStore();
  
  const flowWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      toast.success("User logged in, loading workflows...");
      loadWorkflows();
    }
  }, [user, loadWorkflows]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!user) return;
      
      if (event.ctrlKey && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      }
      
      if ((event.ctrlKey && event.shiftKey && event.key === 'z') || 
          (event.ctrlKey && event.key === 'y')) {
        event.preventDefault();
        redo();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [undo, redo, user]);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return; // Ensure source & target exist
  
    const newEdge: Edge = {
      id: `edge-${Date.now()}`,
      type: 'conditional',
      data: { condition: 'always' },
      source: connection.source as string,
      target: connection.target as string,
      sourceHandle: connection.sourceHandle || undefined,
      targetHandle: connection.targetHandle || undefined
    };
  
    // Fix: Call setEdges directly with the new array instead of passing a function
    setEdges([...edges, newEdge]);
  }, [setEdges, edges]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Fix: Call setNodes directly with the result of applyNodeChanges
      setNodes(applyNodeChanges(changes, nodes));
    },
    [setNodes, nodes]
  );

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const nodeType = event.dataTransfer.getData("application/reactflow");
    if (!nodeType) return;
  
    const reactFlowBounds = flowWrapperRef.current?.getBoundingClientRect();
    const position = reactFlowBounds
      ? { x: event.clientX - reactFlowBounds.left - 75, y: event.clientY - reactFlowBounds.top - 20 }
      : { x: event.clientX - 200, y: event.clientY - 50 };
  
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: nodeType,
      position,
      data: { 
        label: "AI Task Node",
        parameters: {
          prompt: "",
          model: "gpt-4o-mini",
          maxTokens: 100,
          temperature: 0.7
        }
      },
      draggable: true,
    };
  
    // Fix: Call setNodes directly with the new array instead of passing a function
    setNodes([...nodes, newNode]);
  };

  const handleManualSave = () => {
    saveWorkflow(workflowName);
  };

  return (
    <div className="flex w-full h-screen">
      {/* <AiNode /> */}
      <div className="flex-grow flex flex-col">
        {user && <WorkflowExecutionPanel />}
        <div
          ref={flowWrapperRef}
          className="flex-grow w-full h-screen bg-gray-200 relative"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <ReactFlow 
            nodes={nodes} 
            edges={edges} 
            onNodesChange={onNodesChange} 
            onConnect={onConnect} 
            fitView 
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={{ type: 'conditional' }}
          >
            <Panel position="top-right" className="bg-white shadow-md rounded-md p-2 flex gap-2">
              <button
                onClick={undo}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700 transition-colors"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 size={18} />
              </button>
              <button
                onClick={redo}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700 transition-colors"
                title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
              >
                <Redo2 size={18} />
              </button>
              <button
                onClick={handleManualSave}
                className="p-2 bg-blue-100 hover:bg-blue-200 rounded-md text-blue-700 transition-colors"
                title="Save Workflow"
              >
                <Save size={18} />
              </button>
            </Panel>
            <MiniMap />
            <Controls />
            <Background />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
};

export default WorkflowBuilder;