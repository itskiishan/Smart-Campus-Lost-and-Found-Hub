"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { CampusLocationRow } from "@/types/database";
import { CAMPUS_LOCATIONS } from "@/lib/locations";
import AdminLayout from "@/components/AdminLayout";
import StatusBadge from "@/components/admin/StatusBadge";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import EmptyState from "@/components/admin/EmptyState";
import ErrorState from "@/components/admin/ErrorState";

export default function AdminLocationsPage() {
  const [locations, setLocations] = useState<CampusLocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Location Form
  const [newLocationName, setNewLocationName] = useState("");
  const [newBuildingBlock, setNewBuildingBlock] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Edit Location Modal State
  const [editingLocation, setEditingLocation] = useState<CampusLocationRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editBlock, setEditBlock] = useState("");

  // Deactivate Target
  const [deactivateTarget, setDeactivateTarget] = useState<CampusLocationRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcErr } = await (supabase as any).rpc("admin_get_locations");

      if (rpcErr) {
        console.error("admin_get_locations error:", rpcErr);
        setError(`Failed to load locations: ${rpcErr.message}`);
      } else if (data && Array.isArray(data) && data.length > 0) {
        setLocations(data as CampusLocationRow[]);
      } else {
        // Fallback: populate initial list from CAMPUS_LOCATIONS
        const initialLocations: CampusLocationRow[] = CAMPUS_LOCATIONS.filter(
          (l) => l !== "All Locations"
        ).map((name, idx) => ({
          id: `loc-${idx}`,
          name,
          building_block: name.split("-")[0]?.trim() || "Main Campus",
          is_active: true,
          created_at: new Date().toISOString(),
        }));
        setLocations(initialLocations);
      }
    } catch (err) {
      console.error("Fetch locations exception:", err);
      setError(err instanceof Error ? err.message : "Error loading locations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameTrimmed = newLocationName.trim();
    if (!nameTrimmed) {
      setFormError("Location name cannot be empty.");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const { error: rpcErr } = await (supabase as any).rpc("admin_create_location", {
        p_name: nameTrimmed,
        p_building_block: newBuildingBlock.trim() || null,
      });

      if (rpcErr) {
        console.error("admin_create_location error:", rpcErr);
        setFormError(`Failed to add location: ${rpcErr.message}`);
      } else {
        setNewLocationName("");
        setNewBuildingBlock("");
        await fetchLocations();
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLocation) return;
    const nameTrimmed = editName.trim();
    if (!nameTrimmed) {
      setFormError("Location name cannot be empty.");
      return;
    }

    setActionLoading(true);
    try {
      const { error: rpcErr } = await (supabase as any).rpc("admin_update_location", {
        p_location_id: editingLocation.id,
        p_name: nameTrimmed,
        p_building_block: editBlock.trim() || null,
      });

      if (rpcErr) {
        console.error("admin_update_location error:", rpcErr);
        setFormError(`Failed to update location: ${rpcErr.message}`);
      } else {
        setEditingLocation(null);
        await fetchLocations();
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteDeactivate = async () => {
    if (!deactivateTarget) return;
    setActionLoading(true);

    try {
      const { error: rpcErr } = await (supabase as any).rpc("admin_deactivate_location", {
        p_location_id: deactivateTarget.id,
      });

      if (rpcErr) {
        console.error("admin_deactivate_location error:", rpcErr);
        setError(`Failed to deactivate location: ${rpcErr.message}`);
      } else {
        setDeactivateTarget(null);
        await fetchLocations();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#E8E6E1] pb-4">
          <div>
            <h1 className="text-xl font-extrabold text-[#171717] sm:text-2xl">
              Campus Locations Management
            </h1>
            <p className="text-xs text-[#6B6B67] mt-0.5">
              Add new buildings, blocks, or designated desks for student location selection.
            </p>
          </div>
        </div>

        {error && <ErrorState message={error} onRetry={fetchLocations} />}
        {formError && <ErrorState title="Validation Error" message={formError} />}

        {/* Add Location Form */}
        <div className="rounded-2xl border border-[#E8E6E1] bg-white p-5 shadow-2xs space-y-3">
          <h2 className="text-xs font-bold text-[#171717] uppercase tracking-wider">
            + Add New Campus Location
          </h2>

          <form onSubmit={handleAddLocation} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <input
                type="text"
                required
                placeholder="Location Name (e.g. Bhabha Block - 4th Floor)"
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
                className="w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-3.5 py-2 text-xs text-[#171717] placeholder-[#6B6B67] focus:border-[#7A1F2B] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <input
                type="text"
                placeholder="Building Block (e.g. Bhabha Block)"
                value={newBuildingBlock}
                onChange={(e) => setNewBuildingBlock(e.target.value)}
                className="w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-3.5 py-2 text-xs text-[#171717] placeholder-[#6B6B67] focus:border-[#7A1F2B] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-[#7A1F2B] py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#631822] disabled:opacity-50"
              >
                {submitting ? "Adding Location..." : "Add Location"}
              </button>
            </div>
          </form>
        </div>

        {/* Locations Grid */}
        <div className="rounded-2xl border border-[#E8E6E1] bg-white p-5 shadow-2xs space-y-4">
          <h2 className="text-xs font-bold text-[#171717] uppercase tracking-wider">
            Registered Campus Locations ({locations.length})
          </h2>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] animate-shimmer" />
              ))}
            </div>
          ) : locations.length === 0 ? (
            <EmptyState
              title="No locations configured"
              description="Use the form above to add designated campus buildings or blocks."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {locations.map((loc) => (
                <div
                  key={loc.id}
                  className="rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] p-3.5 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-[#171717] block">{loc.name}</span>
                    <span className="text-[10px] text-[#6B6B67] block">
                      Block: {loc.building_block || "Main Campus"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusBadge status={loc.is_active ? "active" : "inactive"} type="moderation" />
                    {loc.is_active && !loc.id.startsWith("loc-") && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingLocation(loc);
                            setEditName(loc.name);
                            setEditBlock(loc.building_block || "");
                          }}
                          className="text-[10px] font-semibold text-[#7A1F2B] hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeactivateTarget(loc)}
                          className="text-[10px] font-semibold text-[#C94A4A] hover:underline"
                        >
                          Deactivate
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Edit Location Modal */}
        {editingLocation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-fade-in">
            <div className="w-full max-w-md rounded-2xl border border-[#E8E6E1] bg-white p-6 shadow-md space-y-4 animate-dropdown">
              <h3 className="text-base font-extrabold text-[#171717]">Edit Campus Location</h3>

              <form onSubmit={handleUpdateLocation} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1">
                    Location Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] p-3 text-xs text-[#171717] focus:border-[#7A1F2B] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1">
                    Building Block
                  </label>
                  <input
                    type="text"
                    value={editBlock}
                    onChange={(e) => setEditBlock(e.target.value)}
                    className="w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] p-3 text-xs text-[#171717] focus:border-[#7A1F2B] focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8E6E1]">
                  <button
                    type="button"
                    onClick={() => setEditingLocation(null)}
                    className="rounded-lg border border-[#E8E6E1] bg-white px-4 py-2 text-xs font-semibold text-[#171717]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="rounded-lg bg-[#7A1F2B] px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#631822] disabled:opacity-50"
                  >
                    {actionLoading ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Deactivate Confirmation Dialog */}
        {deactivateTarget && (
          <ConfirmDialog
            isOpen={true}
            title={`Deactivate Location: ${deactivateTarget.name}`}
            description={`Deactivating this location removes it from the public location selector. Existing reports using this location are not changed.`}
            requireReason={false}
            confirmText="Confirm Deactivation"
            confirmButtonVariant="warning"
            isLoading={actionLoading}
            onClose={() => setDeactivateTarget(null)}
            onConfirm={handleExecuteDeactivate}
          />
        )}
      </div>
    </AdminLayout>
  );
}
