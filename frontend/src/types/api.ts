// API Types generated from OpenAPI schema

// Authentication
export interface UserCreate {
  username: string;
  email: string;
  password: string;
}

export interface User {
  username: string;
  email: string;
  id: string;
  is_active?: boolean;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
  grant_type?: string;
  scope?: string;
  client_id?: string | null;
  client_secret?: string | null;
}

// Projects
export interface Project {
  name: string;
  description: string | null;
  id: string;
  owner_id: string;
  category_tags: string[];
  layout_direction?: "TB" | "BT" | "LR" | "RL";
  node_count?: number;
  context_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ProjectCreate {
  name: string;
  description?: string | null;
  source_template_id?: string | null;
  category_tags?: string[];
  layout_direction?: "TB" | "BT" | "LR" | "RL";
}

export interface ProjectUpdate {
  name: string;
  description?: string | null;
  category_tags?: string[];
  layout_direction?: "TB" | "BT" | "LR" | "RL";
}

// Nodes
export interface Node {
  title: string;
  description: string | null;
  status: string;
  findings: string | null;
  x_pos: number;
  y_pos: number;
  id: string;
  tags: string[];
  commands: Command[];
  parents: string[];
  children: string[];
  created_at?: string;
  updated_at?: string;
}

export interface NodeCreate {
  title: string;
  description?: string | null;
  status?: string;
  findings?: string | null;
  x_pos?: number;
  y_pos?: number;
}

export interface NodeUpdate {
  title?: string | null;
  description?: string | null;
  status?: string | null;
  findings?: string | null;
  x_pos?: number | null;
  y_pos?: number | null;
}

// Commands
export interface Command {
  title: string;
  command: string;
  description: string | null;
  id: string;
}

export interface CommandCreate {
  title: string;
  command: string;
  description?: string | null;
}

export interface CommandUpdate {
  title?: string | null;
  command?: string | null;
  description?: string | null;
}

// Contexts
export interface Context {
  name: string;
  description: string | null;
  id: string;
  variables: Variable[];
}

export interface ContextCreate {
  name: string;
  description?: string | null;
}

export interface ContextUpdate {
  name?: string | null;
  description?: string | null;
}

// Variables
export interface Variable {
  name: string;
  value: any;
  description: string | null;
  sensitive: boolean;
  id: string;
}

export interface VariableCreate {
  name: string;
  value: any;
  description?: string | null;
  sensitive?: boolean;
}

export interface VariableUpdate {
  name?: string | null;
  value?: any | null;
  description?: string | null;
  sensitive?: boolean | null;
}

// Templates
export interface Template {
  name: string;
  description: string | null;
  id: string;
  owner_id: string;
  category_tags: string[];
  is_public?: boolean;
  node_count?: number;
  context_count?: number;
}

export interface TemplateCreate {
  name: string;
  description?: string | null;
  source_project_id?: string | null;
  category_tags?: string[];
}

export interface TemplateUpdate {
  name: string;
  description?: string | null;
  category_tags?: string[];
}

// Category Tags
export interface CategoryTag {
  name: string;
  id: string;
}

export interface CategoryTagCreate {
  name: string;
}

// API Response wrapper
export interface ApiResponse<T> {
  data: T;
  message?: string;
  status?: number;
}

// Error types
export interface ValidationError {
  loc: (string | number)[];
  msg: string;
  type: string;
}

export interface HTTPValidationError {
  detail: ValidationError[];
}
