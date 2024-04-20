using Workerd = import "/workerd/workerd.capnp";

const hathExporterConfig :Workerd.Config = (
  services = [ (name = "main", worker = .hathExporterWorker) ],
  sockets = [ ( name = "http", address = "*:8080", http = (), service = "main" ) ]
);

const hathExporterWorker :Workerd.Worker = (
  modules = [
    (name = "worker", esModule = embed "dist/worker.js")
  ],
  compatibilityDate = "2024-04-05",
  compatibilityFlags = ["nodejs_compat"]
);
