import { useState } from "react";
import {
  useStatefulSets,
  useDaemonSets,
  useJobs,
  useCronJobs,
} from "../../hooks/useKube";
import { useAppStore } from "../../lib/store";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/Table";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { RefreshCw } from "lucide-react";

type WorkloadType = "statefulsets" | "daemonsets" | "jobs" | "cronjobs";

export function WorkloadsList() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const [activeTab, setActiveTab] = useState<WorkloadType>("statefulsets");

  const { data: statefulsets, isLoading: stsLoading, error: stsError, refetch: stsRefetch } =
    useStatefulSets(currentNamespace);
  const { data: daemonsets, isLoading: dsLoading, error: dsError, refetch: dsRefetch } =
    useDaemonSets(currentNamespace);
  const { data: jobs, isLoading: jobsLoading, error: jobsError, refetch: jobsRefetch } =
    useJobs(currentNamespace);
  const { data: cronjobs, isLoading: cjLoading, error: cjError, refetch: cjRefetch } =
    useCronJobs(currentNamespace);

  const tabs: { value: WorkloadType; label: string; count: number }[] = [
    { value: "statefulsets", label: "StatefulSets", count: statefulsets?.length || 0 },
    { value: "daemonsets", label: "DaemonSets", count: daemonsets?.length || 0 },
    { value: "jobs", label: "Jobs", count: jobs?.length || 0 },
    { value: "cronjobs", label: "CronJobs", count: cronjobs?.length || 0 },
  ];

  const handleRefresh = () => {
    switch (activeTab) {
      case "statefulsets":
        stsRefetch();
        break;
      case "daemonsets":
        dsRefetch();
        break;
      case "jobs":
        jobsRefetch();
        break;
      case "cronjobs":
        cjRefetch();
        break;
    }
  };

  const isLoading = stsLoading || dsLoading || jobsLoading || cjLoading;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Workloads</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="flex space-x-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            <Badge variant="secondary" className="ml-2">
              {tab.count}
            </Badge>
          </button>
        ))}
      </div>

      {activeTab === "statefulsets" && (
        <StatefulSetsTable
          data={statefulsets}
          isLoading={stsLoading}
          error={stsError}
        />
      )}
      {activeTab === "daemonsets" && (
        <DaemonSetsTable
          data={daemonsets}
          isLoading={dsLoading}
          error={dsError}
        />
      )}
      {activeTab === "jobs" && (
        <JobsTable data={jobs} isLoading={jobsLoading} error={jobsError} />
      )}
      {activeTab === "cronjobs" && (
        <CronJobsTable data={cronjobs} isLoading={cjLoading} error={cjError} />
      )}
    </div>
  );
}

function StatefulSetsTable({ data, isLoading, error }: any) {
  const currentNamespace = useAppStore((state) => state.currentNamespace);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        Error loading statefulsets: {error.message}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No statefulsets found in namespace "{currentNamespace}"
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Ready</TableHead>
          <TableHead>Replicas</TableHead>
          <TableHead>Age</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((sts: any) => (
          <TableRow key={sts.name}>
            <TableCell className="font-medium">{sts.name}</TableCell>
            <TableCell>
              <Badge
                variant={
                  sts.ready === `${sts.replicas}/${sts.replicas}`
                    ? "success"
                    : "warning"
                }
              >
                {sts.ready}
              </Badge>
            </TableCell>
            <TableCell>{sts.replicas}</TableCell>
            <TableCell>{sts.age}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function DaemonSetsTable({ data, isLoading, error }: any) {
  const currentNamespace = useAppStore((state) => state.currentNamespace);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        Error loading daemonsets: {error.message}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No daemonsets found in namespace "{currentNamespace}"
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Desired</TableHead>
          <TableHead>Current</TableHead>
          <TableHead>Ready</TableHead>
          <TableHead>Up-to-date</TableHead>
          <TableHead>Available</TableHead>
          <TableHead>Age</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((ds: any) => (
          <TableRow key={ds.name}>
            <TableCell className="font-medium">{ds.name}</TableCell>
            <TableCell>{ds.desired}</TableCell>
            <TableCell>{ds.current}</TableCell>
            <TableCell>
              <Badge variant={ds.ready === ds.desired ? "success" : "warning"}>
                {ds.ready}
              </Badge>
            </TableCell>
            <TableCell>{ds.up_to_date}</TableCell>
            <TableCell>{ds.available}</TableCell>
            <TableCell>{ds.age}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function JobsTable({ data, isLoading, error }: any) {
  const currentNamespace = useAppStore((state) => state.currentNamespace);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">Error loading jobs: {error.message}</div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No jobs found in namespace "{currentNamespace}"
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Completions</TableHead>
          <TableHead>Active</TableHead>
          <TableHead>Succeeded</TableHead>
          <TableHead>Failed</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Age</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((job: any) => (
          <TableRow key={job.name}>
            <TableCell className="font-medium">{job.name}</TableCell>
            <TableCell>{job.completions}</TableCell>
            <TableCell>
              {job.active > 0 && (
                <Badge variant="warning">{job.active}</Badge>
              )}
            </TableCell>
            <TableCell>
              {job.succeeded > 0 && (
                <Badge variant="success">{job.succeeded}</Badge>
              )}
            </TableCell>
            <TableCell>
              {job.failed > 0 && (
                <Badge variant="destructive">{job.failed}</Badge>
              )}
            </TableCell>
            <TableCell>{job.duration}</TableCell>
            <TableCell>{job.age}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CronJobsTable({ data, isLoading, error }: any) {
  const currentNamespace = useAppStore((state) => state.currentNamespace);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        Error loading cronjobs: {error.message}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No cronjobs found in namespace "{currentNamespace}"
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Schedule</TableHead>
          <TableHead>Suspend</TableHead>
          <TableHead>Active</TableHead>
          <TableHead>Last Schedule</TableHead>
          <TableHead>Age</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((cj: any) => (
          <TableRow key={cj.name}>
            <TableCell className="font-medium">{cj.name}</TableCell>
            <TableCell>
              <code className="text-sm bg-muted px-2 py-1 rounded">
                {cj.schedule}
              </code>
            </TableCell>
            <TableCell>
              {cj.suspend && <Badge variant="warning">Suspended</Badge>}
            </TableCell>
            <TableCell>
              {cj.active > 0 && <Badge variant="success">{cj.active}</Badge>}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {cj.last_schedule || "Never"}
            </TableCell>
            <TableCell>{cj.age}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
