"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Users, Landmark, Map, Swords, EyeOff, Crown } from "lucide-react";
import { useGame } from "./GameProvider";
import { HEIST_TYPES, HEIST_ROLES } from "@/lib/game/heists";

interface FamilyState {
  id: string;
  name: string;
  treasury: number;
  myRole: string;
  members: { username: string; rankKey: string; role: string; isDead: boolean }[];
  districts: { id: number; key: string }[];
  wars: { id: string; districtKey: string; attacking: boolean; endsAt: string }[];
  heists: {
    id: string;
    typeKey: string;
    status: string;
    payoutEach: number;
    roles: { role: string; username: string }[];
    createdAt: string;
  }[];
  betrayals: { id: string; exposed: boolean; username: string | null; reward: number; at: string }[];
}

interface InviteRow {
  id: string;
  familyName: string;
}

interface DistrictRow {
  id: number;
  key: string;
  taxPct: number;
  ownerFamilyName: string | null;
  underAttack: boolean;
  isHere: boolean;
}

interface FamilyRankRow {
  position: number;
  name: string;
  members: number;
  districts: number;
  totalXp: number;
}

async function postJson(path: string, body?: unknown) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export function Family() {
  const t = useTranslations();
  const { me, refresh } = useGame();

  const [family, setFamily] = useState<FamilyState | null>(null);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [districts, setDistricts] = useState<DistrictRow[] | null>(null);
  const [ranking, setRanking] = useState<FamilyRankRow[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [createName, setCreateName] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [treasuryAmount, setTreasuryAmount] = useState("");

  const load = useCallback(
    () =>
      Promise.all([
        fetch("/api/family").then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            setFamily(data.family);
            setInvites(data.invites);
            setLoaded(true);
          }
        }),
        fetch("/api/districts").then(async (res) => {
          if (res.ok) setDistricts(await res.json());
        }),
        fetch("/api/family/list").then(async (res) => {
          if (res.ok) setRanking(await res.json());
        }),
      ]),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  function showError(code: string) {
    const key = `family.errors.${code}`;
    setNotice(null);
    setError(t.has(key) ? t(key) : t("common.error"));
  }

  function showNotice(text: string) {
    setError(null);
    setNotice(text);
  }

  async function act(path: string, body?: unknown, successText?: string) {
    const { ok, data } = await postJson(path, body);
    if (!ok) {
      showError(data.error ?? "invalid_input");
      return null;
    }
    if (successText) showNotice(successText);
    else setError(null);
    refresh();
    load();
    return data;
  }

  if (!loaded) return <p className="text-ivory-dim">{t("common.loading")}</p>;

  const canManage = family?.myRole === "BOSS" || family?.myRole === "UNDERBOSS";
  const myRankId = me?.rank.id ?? 1;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl text-ivory">{t("family.title")}</h2>
        <p className="text-sm italic text-ivory-dim">{t("family.subtitle")}</p>
      </div>

      {error && <p className="text-sm text-blood-bright">{error}</p>}
      {notice && <p className="text-sm text-gold">{notice}</p>}

      {!family && (
        <>
          {invites.length > 0 && (
            <section className="dossier p-4">
              <h3 className="font-display text-base">{t("family.invitesTitle")}</h3>
              {invites.map((invite) => (
                <div key={invite.id} className="mt-2 flex items-center gap-2 text-sm">
                  <span className="flex-1">{invite.familyName}</span>
                  <button
                    onClick={() => act("/api/family/respond", { inviteId: invite.id, accept: true })}
                    className="rounded bg-gold px-3 py-1 font-display text-xs text-night"
                  >
                    {t("family.accept")}
                  </button>
                  <button
                    onClick={() => act("/api/family/respond", { inviteId: invite.id, accept: false })}
                    className="rounded border border-blood px-3 py-1 text-xs text-blood-bright"
                  >
                    {t("family.decline")}
                  </button>
                </div>
              ))}
            </section>
          )}

          <section className="dossier p-4">
            <h3 className="font-display text-base">{t("family.createTitle")}</h3>
            <p className="mt-1 text-sm text-ivory-dim">
              {t("family.createDesc", { cost: 1000, rank: t("ranks.picciotto") })}
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                act("/api/family/create", { name: createName.trim() }, t("family.created"));
              }}
              className="mt-2 flex gap-2"
            >
              <input
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                placeholder={t("family.namePlaceholder")}
                className="w-full rounded border border-gold/30 bg-night px-3 py-2 text-ivory outline-none focus:border-gold"
              />
              <button
                type="submit"
                disabled={createName.trim().length < 3}
                className="shrink-0 rounded bg-gold px-4 py-2 font-display text-sm text-night transition-transform active:scale-95 disabled:opacity-50"
              >
                {t("family.createButton")}
              </button>
            </form>
          </section>
        </>
      )}

      {family && (
        <>
          <section className="dossier p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="flex items-center gap-2 font-display text-lg text-gold">
                <Crown size={16} /> {family.name}
              </h3>
              <span className="text-xs text-ivory-dim">{t(`family.roles.${family.myRole}`)}</span>
            </div>
            <p className="mt-2 flex items-center gap-2 text-sm">
              <Landmark size={14} className="text-gold" />
              {t("family.treasury")}:{" "}
              <span className="font-display text-gold tabular-nums">
                {family.treasury.toLocaleString()} OMD
              </span>
            </p>
            <div className="mt-2 flex gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={treasuryAmount}
                onChange={(event) => setTreasuryAmount(event.target.value)}
                placeholder="OMD"
                className="w-full rounded border border-gold/30 bg-night px-3 py-2 text-sm text-ivory outline-none focus:border-gold"
              />
              <button
                onClick={() =>
                  act("/api/family/treasury", {
                    action: "deposit",
                    amount: Number.parseInt(treasuryAmount, 10),
                  })
                }
                disabled={!treasuryAmount}
                className="shrink-0 rounded bg-gold px-3 py-2 font-display text-xs text-night disabled:opacity-50"
              >
                {t("family.deposit")}
              </button>
              {canManage && (
                <button
                  onClick={() =>
                    act("/api/family/treasury", {
                      action: "withdraw",
                      amount: Number.parseInt(treasuryAmount, 10),
                    })
                  }
                  disabled={!treasuryAmount}
                  className="shrink-0 rounded border border-gold/40 px-3 py-2 text-xs text-gold disabled:opacity-50"
                >
                  {t("family.withdraw")}
                </button>
              )}
            </div>
          </section>

          <section className="dossier p-4">
            <h3 className="flex items-center gap-2 font-display text-base">
              <Users size={16} /> {t("family.membersTitle", { count: family.members.length })}
            </h3>
            <div className="mt-2 divide-y divide-gold/10">
              {family.members.map((member) => (
                <div key={member.username} className="flex items-center gap-2 py-2 text-sm">
                  <span className={`flex-1 ${member.isDead ? "line-through opacity-50" : ""}`}>
                    {member.username}
                    <span className="ml-2 text-xs text-ivory-dim">
                      {t(`ranks.${member.rankKey}`)} · {t(`family.roles.${member.role}`)}
                    </span>
                  </span>
                  {family.myRole === "BOSS" &&
                    member.username !== me?.username &&
                    member.role !== "BOSS" && (
                      <>
                        <button
                          onClick={() => act("/api/family/promote", { username: member.username })}
                          className="rounded border border-gold/40 px-2 py-0.5 text-xs text-gold"
                        >
                          {member.role === "UNDERBOSS" ? t("family.demote") : t("family.promote")}
                        </button>
                        <button
                          onClick={() => act("/api/family/kick", { username: member.username })}
                          className="rounded border border-blood px-2 py-0.5 text-xs text-blood-bright"
                        >
                          {t("family.kick")}
                        </button>
                      </>
                    )}
                </div>
              ))}
            </div>
            {canManage && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  act("/api/family/invite", { username: inviteName.trim() }, t("family.invited"));
                  setInviteName("");
                }}
                className="mt-2 flex gap-2"
              >
                <input
                  value={inviteName}
                  onChange={(event) => setInviteName(event.target.value)}
                  placeholder={t("city.searchPlaceholder")}
                  className="w-full rounded border border-gold/30 bg-night px-3 py-2 text-sm text-ivory outline-none focus:border-gold"
                />
                <button
                  type="submit"
                  disabled={!inviteName.trim()}
                  className="shrink-0 rounded bg-gold px-3 py-2 font-display text-xs text-night disabled:opacity-50"
                >
                  {t("family.inviteButton")}
                </button>
              </form>
            )}
            <button
              onClick={() => act("/api/family/leave", undefined, t("family.left"))}
              className="mt-3 w-full rounded border border-blood/60 px-3 py-1.5 text-xs text-blood-bright"
            >
              {t("family.leaveButton")}
            </button>
          </section>

          <section className="dossier p-4">
            <h3 className="flex items-center gap-2 font-display text-base">
              <Swords size={16} /> {t("family.heistsTitle")}
            </h3>
            <div className="mt-2 space-y-2">
              {family.heists.filter((heist) => heist.status === "OPEN").length === 0 && (
                <div className="flex flex-wrap gap-2">
                  {HEIST_TYPES.map((type) => (
                    <button
                      key={type.key}
                      onClick={() =>
                        act(
                          "/api/heist/start",
                          { typeKey: type.key, role: "DRIVER" },
                          t("family.heistStarted"),
                        )
                      }
                      disabled={myRankId < type.minRankId}
                      className="rounded border border-gold/40 px-3 py-1.5 text-xs text-gold disabled:opacity-40"
                    >
                      {t(`heists.${type.key}`)} ({type.minPayoutEach}–{type.maxPayoutEach})
                    </button>
                  ))}
                </div>
              )}
              {family.heists.map((heist) => (
                <div key={heist.id} className="rounded border border-gold/20 bg-night/50 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-display">{t(`heists.${heist.typeKey}`)}</span>
                    <span
                      className={
                        heist.status === "SUCCESS"
                          ? "text-gold"
                          : heist.status === "FAILED"
                            ? "text-blood-bright"
                            : "text-ivory-dim"
                      }
                    >
                      {t(`family.heistStatus.${heist.status}`)}
                      {heist.status === "SUCCESS" && ` · ${heist.payoutEach} OMD`}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ivory-dim">
                    {HEIST_ROLES.map((role) => {
                      const filled = heist.roles.find((r) => r.role === role);
                      return `${t(`family.heistRoles.${role}`)}: ${filled?.username ?? "—"}`;
                    }).join(" · ")}
                  </p>
                  {heist.status === "OPEN" && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {!heist.roles.some((r) => r.username === me?.username) &&
                        HEIST_ROLES.filter(
                          (role) => !heist.roles.some((r) => r.role === role),
                        ).map((role) => (
                          <button
                            key={role}
                            onClick={() => act("/api/heist/join", { heistId: heist.id, role })}
                            className="rounded border border-gold/40 px-2.5 py-1 text-xs text-gold"
                          >
                            {t("family.joinAs", { role: t(`family.heistRoles.${role}`) })}
                          </button>
                        ))}
                      {heist.roles.length === HEIST_ROLES.length && (
                        <button
                          onClick={() => act("/api/heist/execute", { heistId: heist.id })}
                          className="rounded bg-blood px-3 py-1 font-display text-xs text-ivory"
                        >
                          {t("family.executeHeist")}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="dossier border-blood/30 p-4">
            <h3 className="flex items-center gap-2 font-display text-base text-blood-bright">
              <EyeOff size={16} /> {t("family.betrayTitle")}
            </h3>
            <p className="mt-1 text-xs text-ivory-dim">{t("family.betrayDesc")}</p>
            <button
              onClick={async () => {
                const data = await act("/api/betray");
                if (data) {
                  showNotice(
                    data.exposed
                      ? t("family.betrayExposed", { reward: Number(data.reward) })
                      : t("family.betraySuccess", { reward: Number(data.reward) }),
                  );
                }
              }}
              className="mt-2 rounded border border-blood px-3 py-1.5 text-xs text-blood-bright"
            >
              {t("family.betrayButton")}
            </button>
            {family.betrayals.length > 0 && (
              <div className="mt-2 space-y-1 text-xs text-ivory-dim">
                {family.betrayals.map((betrayal) => (
                  <p key={betrayal.id}>
                    {betrayal.exposed
                      ? t("family.betrayalExposedLog", { username: betrayal.username ?? "?" })
                      : t("family.betrayalAnonLog", { reward: betrayal.reward })}
                  </p>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <section>
        <h3 className="flex items-center gap-2 font-display text-base text-ivory">
          <Map size={16} /> {t("family.districtsTitle")}
        </h3>
        <div className="dossier mt-2 divide-y divide-gold/10">
          {districts?.map((district) => (
            <div key={district.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p>
                  {t(`districts.${district.key}`)}
                  {district.isHere && (
                    <span className="ml-2 text-xs text-gold">{t("family.youAreHere")}</span>
                  )}
                  {district.underAttack && (
                    <span className="ml-2 text-xs text-blood-bright">{t("family.underAttack")}</span>
                  )}
                </p>
                <p className="text-xs text-ivory-dim">
                  {district.ownerFamilyName
                    ? t("family.ownedBy", { name: district.ownerFamilyName, pct: district.taxPct })
                    : t("family.unowned")}
                </p>
              </div>
              {!district.isHere && (
                <button
                  onClick={() => act("/api/districts/move", { districtId: district.id })}
                  className="rounded border border-gold/40 px-2.5 py-1 text-xs text-gold"
                >
                  {t("family.moveButton")}
                </button>
              )}
              {family && canManage && !district.ownerFamilyName && (
                <button
                  onClick={() =>
                    act("/api/districts/claim", { districtId: district.id }, t("family.claimed"))
                  }
                  className="rounded bg-gold px-2.5 py-1 font-display text-xs text-night"
                >
                  {t("family.claimButton")}
                </button>
              )}
              {family &&
                canManage &&
                district.ownerFamilyName &&
                district.ownerFamilyName !== family.name &&
                !district.underAttack && (
                  <button
                    onClick={() =>
                      act("/api/districts/war", { districtId: district.id }, t("family.warDeclared"))
                    }
                    className="rounded bg-blood px-2.5 py-1 font-display text-xs text-ivory"
                  >
                    {t("family.warButton")}
                  </button>
                )}
            </div>
          ))}
        </div>
        {family && family.wars.length > 0 && (
          <p className="mt-2 text-xs text-blood-bright">
            {family.wars
              .map((war) =>
                t(war.attacking ? "family.warAttacking" : "family.warDefending", {
                  district: t(`districts.${war.districtKey}`),
                }),
              )
              .join(" · ")}
          </p>
        )}
      </section>

      <section>
        <h3 className="font-display text-base text-ivory">{t("family.rankingTitle")}</h3>
        <div className="dossier mt-2 divide-y divide-gold/10">
          {ranking !== null && ranking.length === 0 && (
            <p className="p-3 text-sm text-ivory-dim">{t("family.noFamilies")}</p>
          )}
          {ranking?.map((row) => (
            <div key={row.name} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="w-6 text-right font-display text-gold tabular-nums">
                {row.position}
              </span>
              <span className="flex-1">
                {row.name}
                <span className="ml-2 text-xs text-ivory-dim">
                  {t("family.rankingMeta", { members: row.members, districts: row.districts })}
                </span>
              </span>
              <span className="text-xs text-ivory-dim tabular-nums">
                {row.totalXp.toLocaleString()} {t("common.xp")}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
