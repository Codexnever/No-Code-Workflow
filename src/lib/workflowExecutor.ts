// src/lib/workflowExecutor.ts

import { Node, Edge } from 'reactflow';
import { toast } from 'react-toastify';
import OpenAI from 'openai';
import { databases, ID, Permission, Role, Query } from './appwrite';

// OpenAI configuration with typed configuration
interface AIModelConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}
// Here we want to add api key from workflowstore not getting from below hardly 
const openaiModels: Record<string, AIModelConfig> = {
  'gpt-4o-mini': {
    apiKey: process.env.OPENAI_API_KEY || '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',
    model: 'gpt-4o-mini',
    maxTokens: 100,
    temperature: 0.7
  },
  // 'gpt-4': {
  //   apiKey: process.env.OPENAI_API_KEY || '',
  //   model: 'gpt-4',
  //   maxTokens: 2000,
  //   temperature: 0.7
  // }
};

// Enhanced type definitions
export interface TaskConfig {
  type: string;
  
  nodeId: string;
  parameters: {
    prompt: string;
    model: string;
    maxTokens?: number;
    temperature?: number;
  };
}

export interface TaskResult {
  success: boolean;
  data?: {
    text: string;
    tokens: number;
    model: string;
  };
  error?: string;
  metadata: {
    nodeId: string;
    workflowExecutionId: string;
    timestamp: string;
    taskType?: string;
  };
}

export interface TaskHandler {
  execute: (config: TaskConfig, previousResults?: Record<string, TaskResult>) => Promise<TaskResult>;
}

// Enhanced AI Task Handler
export class AITaskHandler implements TaskHandler {
  async execute(
    config: TaskConfig, 
    previousResults: Record<string, TaskResult> = {}
  ): Promise<TaskResult> {
    try {
      const { prompt, model, maxTokens, temperature } = config.parameters;
      const modelConfig = openaiModels[model] || openaiModels['gpt-4o-mini'];

      const openai = new OpenAI({
        apiKey: modelConfig.apiKey,
        dangerouslyAllowBrowser: true // Use backend in production
      });

      // Enhance prompt with context from previous nodes
      const enhancedPrompt = this.buildContextualPrompt(prompt, previousResults);

      const response = await openai.chat.completions.create({
        model: modelConfig.model,
        messages: [{ role: 'user', content: enhancedPrompt }],
        max_tokens: maxTokens || modelConfig.maxTokens,
        temperature: temperature || modelConfig.temperature
      });

      const aiResponse = response.choices[0].message.content || '';

      return {
        success: true,
        data: {
          text: aiResponse,
          tokens: response.usage?.total_tokens || 0,
          model: model
        },
        metadata: {
          nodeId: config.type,
          workflowExecutionId:'', // Will be set during workflow execution
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('AI Task execution error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown AI task error',
        metadata: {
          nodeId: config.type,
          workflowExecutionId: '', // Will be set during workflow execution
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  private buildContextualPrompt(
    originalPrompt: string, 
    previousResults: Record<string, TaskResult>
  ): string {
    const contextParts = Object.entries(previousResults)
      .filter(([_, result]) => result.success)
      .map(([nodeId, result]) => 
        `Context from node ${nodeId}: ${result.data?.text || 'No detailed context'}`
      );

    return [
      ...contextParts,
      'Current task prompt:',
      originalPrompt
    ].join('\n\n');
  }
}

// Workflow Execution Utilities
function findNextNodes(
  nodeId: string, 
  edges: Edge[], 
  nodes: Node[], 
  condition: 'success' | 'error' | 'always'
): Node[] {
  const outgoingEdges = edges.filter(edge => edge.source === nodeId);
  const validEdges = outgoingEdges.filter(edge => {
    const edgeCondition = edge.data?.condition || 'always';
    return edgeCondition === 'always' || edgeCondition === condition;
  });
  
  const nextNodeIds = validEdges.map(edge => edge.target);
  return nodes.filter(node => nextNodeIds.includes(node.id));
}

function findStartNode(nodes: Node[], edges: Edge[]): Node | null {
  const nodesWithIncomingEdges = new Set(edges.map(edge => edge.target));
  const startNodes = nodes.filter(node => !nodesWithIncomingEdges.has(node.id));
  return startNodes.length > 0 ? startNodes[0] : null;
}

// Core Workflow Execution
export async function executeWorkflow(
  nodes: Node[], 
  edges: Edge[]
): Promise<Record<string, TaskResult>> {
  const workflowExecutionId = ID.unique();
  const results: Record<string, TaskResult> = {};
  const startNode = findStartNode(nodes, edges);

  if (!startNode) {
    toast.error('No starting node found in the workflow');
    return results;
  }

  const queue: { node: Node, dependencies: string[] }[] = [
    { node: startNode, dependencies: [] }
  ];
  const enqueued = new Set<string>([startNode.id]);
  const executed = new Set<string>();

  while (queue.length > 0) {
    const { node, dependencies } = queue.shift()!;

    // Wait for dependencies to complete
    if (!dependencies.every(depId => executed.has(depId))) {
      queue.push({ node, dependencies });
      continue;
    }

    // Execute the task
    const result = await executeTask(node, results);
    
    // Attach workflow execution ID
    result.metadata.workflowExecutionId = workflowExecutionId;

    // Store workflow result in Appwrite
    await storeWorkflowResult(workflowExecutionId, node.id, result);

    // Track results and executed nodes
    results[node.id] = result;
    executed.add(node.id);

    // Determine next nodes based on execution result
    const condition = result.success ? 'success' : 'error';
    const nextNodes = findNextNodes(node.id, edges, nodes, condition);

    // Queue next nodes
    for (const nextNode of nextNodes) {
      if (!enqueued.has(nextNode.id)) {
        queue.push({ node: nextNode, dependencies: [node.id] });
        enqueued.add(nextNode.id);
      }
    }
  }

  // Notify execution completion
  executed.size < nodes.length
    ? toast.warning(`Only ${executed.size}/${nodes.length} nodes executed.`)
    : toast.success('Workflow executed successfully!');

  return results;
}

// Workflow Result Storage in Appwrite
async function storeWorkflowResult(
  workflowExecutionId: string, 
  nodeId: string, 
  result: TaskResult
) {
  try {
    await databases.createDocument(
      "67b4eba50033539bd242",  // Database ID
      "67c5eb7d001f3c955715",  // Collection ID
      ID.unique(),
      {
        workflowExecutionId,
        nodeId,
        result: JSON.stringify(result),
        timestamp: new Date().toISOString()
      },
      [
        Permission.read(Role.any()),
        Permission.update(Role.any()),
        Permission.delete(Role.any())
      ]
    );
  } catch (error) {
    console.error('Error storing workflow result:', error);
    toast.error('Failed to store workflow result');
  }
}

// Retrieve Workflow Results
export async function fetchWorkflowResults(
  workflowExecutionId: string
): Promise<Record<string, TaskResult>> {
  try {
    const response = await databases.listDocuments(
      "67b4eba50033539bd242",
      "67c5eb7d001f3c955715",
      [Query.equal("workflowExecutionId", workflowExecutionId)]
    );

    return response.documents.reduce((acc, doc) => {
      const result = JSON.parse(doc.result);
      acc[result.metadata.nodeId] = result;
      return acc;
    }, {} as Record<string, TaskResult>);
  } catch (error) {
    console.error('Error fetching workflow results:', error);
    toast.error('Failed to retrieve workflow results');
    return {};
  }
}

// Register AI Task Handler
const taskHandlers: Record<string, TaskHandler> = {};
export function registerTaskHandler(type: string, handler: TaskHandler): void {
  taskHandlers[type] = handler;
}

async function executeTask(
  node: Node, 
  previousResults: Record<string, TaskResult>
): Promise<TaskResult> {
  const nodeType = node.type || 'aiTask';
  const taskConfig: TaskConfig = { 
    type: nodeType, 
    nodeId: node.id,
    parameters: node.data?.parameters || {} 
  };
  
  const handler = taskHandlers[nodeType];
  if (!handler) {
    return { 
      success: false, 
      error: `No handler for task type: ${nodeType}`,
      metadata: {
        nodeId: node.id,
        workflowExecutionId: '',
        timestamp: new Date().toISOString()
      }
    };
  }

  toast.info(`Executing node: ${node.data?.label || node.id}`);
  return await handler.execute(taskConfig, previousResults);
}

// Default AI Task Handler Registration
registerTaskHandler('aiTask', new AITaskHandler());