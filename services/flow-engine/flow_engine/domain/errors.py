"""Domain-level errors for the Flow Engine service."""
from __future__ import annotations


class FlowError(Exception):
    """Base class for flow-related errors."""


class SessionLockError(FlowError):
    """Raised when a conversation lock cannot be acquired."""

    def __init__(self, tenant_id: str, wa_id: str) -> None:
        self.tenant_id = tenant_id
        self.wa_id = wa_id
        super().__init__(f"Cannot acquire lock for {tenant_id}:{wa_id}")


class TenantNotFoundError(FlowError):
    """Raised when a tenant does not exist or has no active config."""

    def __init__(self, tenant_id: str) -> None:
        self.tenant_id = tenant_id
        super().__init__(f"Tenant not found: {tenant_id}")


class NodeExecutionError(FlowError):
    """Raised when a node executor fails (e.g., api_call HTTP error)."""

    def __init__(self, node_id: str, reason: str) -> None:
        self.node_id = node_id
        self.reason = reason
        super().__init__(f"Node {node_id!r} execution failed: {reason}")


class MaxIterationsError(FlowError):
    """Raised when the execution loop exceeds the safety iteration cap."""

    def __init__(self, limit: int) -> None:
        super().__init__(f"Flow execution exceeded {limit} iterations — aborting")
