#!/usr/bin/env python3
"""
Hot reload script for detection service
Monitors main.py for changes and restarts the service
"""

import os
import sys
import time
import subprocess
import signal
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

class PythonFileHandler(FileSystemEventHandler):
    def __init__(self, script_path):
        self.script_path = script_path
        self.process = None
        self.start_process()
    
    def start_process(self):
        """Start the main.py process"""
        if self.process:
            self.process.terminate()
            self.process.wait()
        
        print(f"Starting {self.script_path}...")
        self.process = subprocess.Popen([sys.executable, self.script_path])
    
    def on_modified(self, event):
        """Handle file modification events"""
        if event.is_directory:
            return
        
        # Only restart if main.py is modified
        if event.src_path.endswith('main.py'):
            print(f"File {event.src_path} modified. Restarting...")
            self.start_process()
    
    def stop(self):
        """Stop the process"""
        if self.process:
            self.process.terminate()
            self.process.wait()

def main():
    script_path = "main.py"
    
    if not os.path.exists(script_path):
        print(f"Error: {script_path} not found!")
        sys.exit(1)
    
    print("Starting hot reload for detection service...")
    print("Press Ctrl+C to stop")
    
    # Create event handler
    event_handler = PythonFileHandler(script_path)
    
    # Create observer
    observer = Observer()
    observer.schedule(event_handler, path='.', recursive=False)
    observer.start()
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping hot reload...")
        observer.stop()
        event_handler.stop()
    
    observer.join()
    print("Hot reload stopped.")

if __name__ == "__main__":
    main()
