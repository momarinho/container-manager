declare module 'dockerode' {
  import { EventEmitter } from 'events';

  export interface DockerOptions {
    socketPath?: string;
    host?: string;
    port?: number;
  }

  export class Docker {
    constructor(options?: DockerOptions);
    listContainers(options?: any): Promise<ContainerInfo[]>;
    getContainer(id: string): Container;
    getNetwork(id: string): Network;
    getVersion(): Promise<any>;
    version(): Promise<any>;
    getEvents(options?: any): EventEmitter;
  }

  export interface ExecOptions {
    AttachStdin?: boolean;
    AttachStdout?: boolean;
    AttachStderr?: boolean;
    Tty?: boolean;
    Cmd?: string[];
    Env?: string[];
    WorkingDir?: string;
    User?: string;
  }

  export class Container extends EventEmitter {
    id: string;
    start(options?: any): Promise<any>;
    stop(options?: any): Promise<any>;
    restart(options?: any): Promise<any>;
    pause(): Promise<any>;
    unpause(): Promise<any>;
    logs(options: any): any;
    stats(options?: any): any;
    inspect(): Promise<ContainerInspectInfo>;
    remove(options?: any): Promise<any>;
    exec(options: ExecOptions): Exec;
  }

  export class Exec extends EventEmitter {
    inspect(): Promise<any>;
    start(options: any): EventEmitter;
    resize(options: any): Promise<any>;
  }

  export interface Network {
    inspect(): Promise<any>;
  }

  export interface ContainerInfo {
    Id: string;
    Names: string[];
    Image: string;
    ImageID: string;
    Command: string;
    Created: number;
    State: string;
    Status: string;
    Ports: any[];
    Labels: any;
    SizeRw: number;
    SizeRootFs: number;
    HostConfig: any;
    NetworkSettings: any;
    Mounts: any[];
  }

  export interface ContainerInspectInfo {
    Id: string;
    Name: string;
    State: any;
    Config: any;
    HostConfig: any;
    NetworkSettings: any;
    Image: string;
    Created: number;
    Mounts: any[];
  }

  export interface ContainerStats {
    name: string;
    cpu_stats: any;
    precpu_stats: any;
    memory_stats: any;
    blkio_stats: any;
    networks: any;
  }

  export default Docker;
}


