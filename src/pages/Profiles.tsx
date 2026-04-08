import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, User, Lock, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Profile } from "@/lib/types";

interface ProfilesProps {
  onSelect: (profileId: number) => void;
}

const AVATARS = ["🍡", "🎌", "⚔️", "🌸", "🔥", "🌊", "⭐", "🎭"];

export default function Profiles({ onSelect }: ProfilesProps) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAvatar, setNewAvatar] = useState("🍡");
  const [newPin, setNewPin] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [pinProfile, setPinProfile] = useState<Profile | null>(null);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: api.getProfiles,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.createProfile(newName, newAvatar, newPin || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      setCreating(false);
      setNewName("");
      setNewPin("");
    },
  });

  const handleProfileClick = async (profile: Profile) => {
    if (profile.pin) {
      setPinProfile(profile);
      setPinInput("");
    } else {
      onSelect(profile.id);
    }
  };

  const handlePinSubmit = async () => {
    if (!pinProfile) return;
    const { verified } = await api.verifyPin(pinProfile.id, pinInput);
    if (verified) {
      onSelect(pinProfile.id);
    } else {
      setPinInput("");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4">
      <h1 className="mb-2 text-4xl font-black tracking-[0.18em] text-rose-400">
        MOTCHI
      </h1>
      <p className="text-zinc-400 mb-12">Who's watching?</p>

      {/* PIN entry modal */}
      {pinProfile && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
          <div className="bg-zinc-900 rounded-2xl p-8 max-w-sm w-full text-center space-y-4">
            <Lock size={32} className="text-rose-400 mx-auto" />
            <h3 className="text-white font-bold text-lg">
              Enter PIN for {pinProfile.name}
            </h3>
            <input
              type="password"
              maxLength={4}
              value={pinInput}
              onChange={(e) =>
                setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              onKeyDown={(e) =>
                e.key === "Enter" && pinInput.length === 4 && handlePinSubmit()
              }
              placeholder="4-digit PIN"
              className="w-full text-center text-2xl tracking-[0.5em] bg-zinc-800 border border-zinc-700 rounded-lg py-3 text-white focus:outline-none focus:border-rose-500"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setPinProfile(null)}
                className="flex-1 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={handlePinSubmit}
                disabled={pinInput.length !== 4}
                className="flex-1 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-50"
              >
                Enter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile grid */}
      <div className="flex flex-wrap justify-center gap-6 max-w-3xl">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="w-28 space-y-2">
                <div className="w-28 h-28 rounded-2xl skeleton" />
                <div className="skeleton h-4 rounded" />
              </div>
            ))
          : profiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => handleProfileClick(profile)}
                className="group w-28 space-y-2 text-center"
              >
                <div className="w-28 h-28 rounded-2xl bg-zinc-800 border-2 border-transparent group-hover:border-rose-500 transition-colors flex items-center justify-center text-4xl">
                  {profile.avatar === "default" ? (
                    <User size={40} className="text-zinc-500" />
                  ) : (
                    profile.avatar
                  )}
                </div>
                <p className="text-zinc-300 text-sm font-medium group-hover:text-white transition-colors">
                  {profile.name}
                </p>
                {profile.pin && (
                  <Lock size={12} className="text-zinc-600 mx-auto" />
                )}
              </button>
            ))}

        {/* Add profile */}
        <button
          onClick={() => setCreating(true)}
          className="group w-28 space-y-2 text-center"
        >
          <div className="w-28 h-28 rounded-2xl border-2 border-dashed border-zinc-700 group-hover:border-rose-500 transition-colors flex items-center justify-center">
            <Plus size={32} className="text-zinc-600 group-hover:text-rose-400" />
          </div>
          <p className="text-zinc-500 text-sm">Add Profile</p>
        </button>
      </div>

      {/* Create profile form */}
      {creating && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
          <div className="bg-zinc-900 rounded-2xl p-8 max-w-sm w-full space-y-4">
            <h3 className="text-white font-bold text-lg">New Profile</h3>

            <div>
              <label className="text-zinc-400 text-sm">Avatar</label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {AVATARS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setNewAvatar(a)}
                    className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center ${
                      newAvatar === a
                        ? "bg-rose-500/20 ring-2 ring-rose-500"
                        : "bg-zinc-800 hover:bg-zinc-700"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-zinc-400 text-sm">Name</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Profile name"
                className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-rose-500"
                autoFocus
              />
            </div>

            <div>
              <label className="text-zinc-400 text-sm">
                PIN (optional, 4 digits)
              </label>
              <input
                type="password"
                maxLength={4}
                value={newPin}
                onChange={(e) =>
                  setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                placeholder="Leave blank for no PIN"
                className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setCreating(false)}
                className="flex-1 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!newName.trim()}
                className="flex-1 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
