#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# XMind and Obsidian canvas to Penflow JSON format converter
# pip install xmindparser
# python3 main.py <file_path>.{xmind|obsidian}
# <Import it within a Penflow session>

import argparse
import json
import uuid
from pathlib import Path
from xmindparser import xmind_to_dict

def create_node(name: str, position: dict, node_id: str = None, color: str = None) -> dict:
    """Create a node with default Penflow structure"""
    if node_id is None:
        node_id = str(uuid.uuid4())
        
    node = {
        "id": node_id,
        "type": "custom",
        "position": position,
        "data": {
            "name": name,
            "expanded": True,
            "description": "",
            "findings": [],
            "commands": [],
            "status": "NOT_STARTED",
            "tags": [],
            "properties": {
                "showPosition": False,
                "showId": False
            },
            "expandable": True
        },
        "measured": {
            "width": 172,
            "height": 64
        },
        "selected": False,
        "style": {
            "opacity": 1
        },
        "sourcePosition": "right",
        "targetPosition": "left"
    }
    
    if color:
        node["style"]["backgroundColor"] = color
        
    return node

def process_topic(topic: dict, parent_id: str = None, x: int = 0, y: int = 0) -> tuple:
    """Process a topic and its children, return nodes and edges"""
    nodes = []
    edges = []
    
    
    node_id = str(uuid.uuid4())
    node = create_node(
        name=topic.get('title', 'New Node'),
        position={"x": x, "y": y},
        node_id=node_id
    )
    nodes.append(node)
    
    
    if parent_id:
        edge = {
            "id": f"{parent_id}->{node_id}",
            "source": parent_id,
            "target": node_id,
            "style": {"opacity": 1}
        }
        edges.append(edge)
    
    
    if 'topics' in topic:
        x_offset = 200
        y_offset = 100
        for i, child in enumerate(topic['topics']):
            child_nodes, child_edges = process_topic(
                child,
                node_id,
                x + x_offset,
                y + (i * y_offset)
            )
            nodes.extend(child_nodes)
            edges.extend(child_edges)
    
    return nodes, edges

def parse_obsidian_file(file_path: Path) -> dict:
    """Parse Obsidian canvas file and convert to Penflow format"""
    with open(file_path, 'r', encoding='utf-8') as f:
        obsidian_data = json.load(f)
    
    nodes = []
    edges = []
    
    
    for node in obsidian_data.get("nodes", []):
        node_id = node.get("id")
        node_type = node.get("type", "text")
        
        
        if node_type == "text":
            text = node.get("text", "")
            
            if text.startswith("```"):
                lines = text.split("\n")
                name = lines[1] if len(lines) > 1 else "Code Block"
            else:
                
                name = text.split("\n")[0]
        elif node_type == "file":
            name = node.get("file", "Unnamed File")
        elif node_type == "group":
            name = node.get("label", "Group")
        else:
            name = node.get("text", "Unknown")

        
        position = {
            "x": float(node.get("x", 0)),
            "y": float(node.get("y", 0))
        }
        
        
        penflow_node = create_node(
            name=name,
            position=position,
            node_id=node_id,
            color=node.get("color")
        )
        
        
        if node_type == "group":
            penflow_node["data"]["properties"]["isGroup"] = True
        if "width" in node and "height" in node:
            penflow_node["measured"]["width"] = float(node["width"])
            penflow_node["measured"]["height"] = float(node["height"])
        
        nodes.append(penflow_node)
    
    
    for edge in obsidian_data.get("edges", []):
        source = edge.get("fromNode")
        target = edge.get("toNode")
        
        if source and target:
            edge_id = f"{source}->{target}"
            edge_data = {
                "id": edge_id,
                "source": source,
                "target": target,
                "style": {
                    "opacity": 1
                }
            }
            
            
            if "label" in edge:
                edge_data["label"] = edge["label"]
            if "color" in edge:
                edge_data["style"]["stroke"] = edge["color"]
                
            edges.append(edge_data)
    
    return {
        "nodes": nodes,
        "edges": edges
    }

def parse_xmind_file(file_path: Path) -> dict:
    """Parse XMind file and convert to Penflow format"""
    
    xmind_data = xmind_to_dict(str(file_path))
    
    
    penflow_data = {
        "nodes": [],
        "edges": []
    }
    
    
    for sheet in xmind_data:
        if 'topic' in sheet:
            nodes, edges = process_topic(sheet['topic'])
            penflow_data["nodes"].extend(nodes)
            penflow_data["edges"].extend(edges)
    
    return penflow_data

def convert_to_penflow(file_path: Path) -> None:
    """
    Convert the input file to Penflow format based on file extension
    
    Args:
        file_path (Path): Path to the input file
    """
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")
    
    print(f"Processing file: {file_path}")
    
    
    if file_path.suffix.lower() == '.xmind':
        penflow_data = parse_xmind_file(file_path)
    elif file_path.suffix.lower() == '.obsidian':
        penflow_data = parse_obsidian_file(file_path)
    else:
        raise ValueError(f"Unsupported file format: {file_path.suffix}")
    
    
    output_path = file_path.with_suffix('.penflow.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(penflow_data, f, indent=2)
    
    print(f"Created Penflow file: {output_path}")

def main():
    """Main entry point for xmind2penflow"""
    parser = argparse.ArgumentParser(description='Convert XMind or Obsidian files to Penflow format')
    parser.add_argument('file', type=Path, help='Path to the input file (.xmind or .obsidian)')
    
    args = parser.parse_args()
    convert_to_penflow(args.file)

if __name__ == "__main__":
    main() 