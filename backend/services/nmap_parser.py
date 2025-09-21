"""
Nmap XML parsing service for scope management
"""
import xml.etree.ElementTree as ET
from typing import List, Dict, Optional, Set
from datetime import datetime
from schemas.scope import ScopeAssetCreate, ImportStats
import re

class NmapXMLParser:
    """Parse Nmap XML output and extract service information"""
    
    def __init__(self):
        self.stats = ImportStats(
            hosts_processed=0,
            services_created=0,
            services_updated=0,
            hostnames_linked=0,
            vhosts_detected=0,
            errors=[]
        )
    
    def parse_xml(self, xml_content: str, settings: Optional[Dict] = None) -> List[ScopeAssetCreate]:
        """
        Parse Nmap XML content and return list of scope assets
        
        Args:
            xml_content: Raw XML content from Nmap scan
            settings: Optional parsing settings (open_ports_only, default_status, etc.)
            
        Returns:
            List of ScopeAssetCreate objects
        """
        if settings is None:
            settings = {}
            
        # Default settings
        open_ports_only = settings.get('open_ports_only', True)
        default_status = settings.get('default_status', 'not_tested')
        
        assets = []
        
        try:
            # Parse XML
            root = ET.fromstring(xml_content)
            
            # Process each host
            for host in root.findall('.//host'):
                try:
                    host_info = self._parse_host(host, open_ports_only, default_status)
                    if host_info:
                        assets.extend(host_info['assets'])
                        self.stats.hosts_processed += 1
                        self.stats.hostnames_linked += len(host_info.get('hostnames', []))
                        
                except Exception as e:
                    error_msg = f"Error parsing host: {str(e)}"
                    self.stats.errors.append(error_msg)
                    
        except ET.ParseError as e:
            self.stats.errors.append(f"XML parsing error: {str(e)}")
        except Exception as e:
            self.stats.errors.append(f"Unexpected error: {str(e)}")
            
        self.stats.services_created = len(assets)
        return assets
    
    def _parse_host(self, host_elem, open_ports_only: bool, default_status: str) -> Optional[Dict]:
        """Parse individual host element"""
        
        # Check if host is up
        status = host_elem.find('status')
        if status is not None and status.get('state') != 'up':
            return None
            
        # Get IP address
        address_elem = host_elem.find('.//address[@addrtype="ipv4"]')
        if address_elem is None:
            return None
            
        ip_address = address_elem.get('addr')
        if not ip_address:
            return None
            
        # Get hostnames
        hostnames = []
        for hostname in host_elem.findall('.//hostname'):
            name = hostname.get('name')
            if name:
                hostnames.append(name)
                
        # Get ports and services
        assets = []
        ports_elem = host_elem.find('ports')
        
        if ports_elem is not None:
            for port in ports_elem.findall('port'):
                try:
                    asset = self._parse_port(port, ip_address, hostnames, open_ports_only, default_status)
                    if asset:
                        assets.append(asset)
                except Exception as e:
                    self.stats.errors.append(f"Error parsing port on {ip_address}: {str(e)}")
                    
        return {
            'ip': ip_address,
            'hostnames': hostnames,
            'assets': assets
        }
    
    def _parse_port(self, port_elem, ip_address: str, hostnames: List[str], 
                   open_ports_only: bool, default_status: str) -> Optional[ScopeAssetCreate]:
        """Parse individual port element"""
        
        # Get port number and protocol
        port_num = port_elem.get('portid')
        protocol = port_elem.get('protocol', 'tcp')
        
        if not port_num:
            return None
            
        try:
            port_number = int(port_num)
        except ValueError:
            return None
            
        # Check port state
        state_elem = port_elem.find('state')
        if state_elem is None:
            return None
            
        port_state = state_elem.get('state', 'closed')
        
        # Skip closed/filtered ports if only_open_ports is True
        if open_ports_only and port_state not in ['open']:
            return None
            
        # Get service information
        service_elem = port_elem.find('service')
        service_name = ''
        service_product = ''
        service_version = ''
        
        if service_elem is not None:
            service_name = service_elem.get('name', '')
            service_product = service_elem.get('product', '')
            service_version = service_elem.get('version', '')
            
        # Detect virtual hosts from HTTP services
        vhosts = self._detect_vhosts(port_elem, service_name)
        
        # Create notes with service information
        notes_parts = []
        if service_name:
            notes_parts.append(f"Service: {service_name}")
        if service_product:
            notes_parts.append(f"Product: {service_product}")
        if service_version:
            notes_parts.append(f"Version: {service_version}")
        if port_state != 'open':
            notes_parts.append(f"State: {port_state}")
            
        notes = " | ".join(notes_parts) if notes_parts else f"Port {port_number}/{protocol}"
        
        return ScopeAssetCreate(
            ip=ip_address,
            port=port_number,
            protocol=protocol,
            hostnames=hostnames.copy() if hostnames else [],
            vhosts=vhosts,
            status=default_status,
            discovered_via="nmap",
            notes=notes
        )
    
    def _detect_vhosts(self, port_elem, service_name: str) -> List[str]:
        """Detect virtual hosts from HTTP services"""
        vhosts = []
        
        # Look for HTTP services
        if service_name.lower() not in ['http', 'https', 'http-proxy', 'http-alt']:
            return vhosts
            
        # Look for script output that might contain virtual hosts
        for script in port_elem.findall('.//script'):
            script_id = script.get('id', '')
            script_output = script.get('output', '')
            
            # Check for http-enum, http-title, or other scripts that reveal vhosts
            if any(keyword in script_id for keyword in ['http-enum', 'http-title', 'http-headers']):
                # Extract potential hostnames from script output
                # Simple regex to find domain-like patterns
                domain_pattern = r'\b([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\b'
                potential_domains = re.findall(domain_pattern, script_output)
                
                for domain in potential_domains:
                    if domain not in vhosts and self._is_valid_hostname(domain):
                        vhosts.append(domain)
                        self.stats.vhosts_detected += 1
                        
        return vhosts
    
    def _is_valid_hostname(self, hostname: str) -> bool:
        """Basic validation for hostnames"""
        if not hostname or len(hostname) > 253:
            return False
            
        # Skip common false positives
        skip_patterns = [
            'www.example.com',
            'localhost',
            'example.com',
            'test.com'
        ]
        
        if hostname.lower() in skip_patterns:
            return False
            
        # Basic hostname validation
        if hostname.startswith('.') or hostname.endswith('.'):
            return False
            
        return True
    
    def get_stats(self) -> ImportStats:
        """Get import statistics"""
        return self.stats


def parse_nmap_xml(xml_content: str, settings: Optional[Dict] = None) -> tuple[List[ScopeAssetCreate], ImportStats]:
    """
    Convenience function to parse Nmap XML
    
    Args:
        xml_content: Raw XML content
        settings: Optional parsing settings
        
    Returns:
        Tuple of (assets_list, import_stats)
    """
    parser = NmapXMLParser()
    assets = parser.parse_xml(xml_content, settings)
    stats = parser.get_stats()
    
    return assets, stats