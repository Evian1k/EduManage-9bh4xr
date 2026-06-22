import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Modal, Pressable, ScrollView, TextInput } from 'react-native';
import { useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import {
  getRoutes, createRoute,
  getVehicles, createVehicle,
  getDrivers, createDriver,
  getTransportStats,
  TransportRoute, TransportVehicle, TransportDriver, TransportStats,
} from '@/services/transport.service';

type Tab = 'dashboard' | 'routes' | 'vehicles' | 'drivers';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'routes', label: 'Routes' },
  { id: 'vehicles', label: 'Vehicles' },
  { id: 'drivers', label: 'Drivers' },
];

function formatCurrency(amount: number) {
  return `KES ${Number(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export default function TransportScreen() {
  const { school } = useAppContext();
  const { showAlert } = useAlert();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [vehicles, setVehicles] = useState<TransportVehicle[]>([]);
  const [drivers, setDrivers] = useState<TransportDriver[]>([]);
  const [stats, setStats] = useState<TransportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // forms
  const [routeForm, setRouteForm] = useState({ route_name: '', route_code: '', start_point: '', end_point: '', fee: '' });
  const [vehicleForm, setVehicleForm] = useState({ registration_number: '', make: '', model: '', capacity: '30' });
  const [driverForm, setDriverForm] = useState({ full_name: '', license_number: '', phone: '' });

  const load = useCallback(async () => {
    if (!school) return;
    const [routesRes, vehiclesRes, driversRes, statsRes] = await Promise.all([
      getRoutes(school.id),
      getVehicles(school.id),
      getDrivers(school.id),
      getTransportStats(school.id),
    ]);
    setRoutes(routesRes.data || []);
    setVehicles(vehiclesRes.data || []);
    setDrivers(driversRes.data || []);
    setStats(statsRes.data);
    setLoading(false);
    setRefreshing(false);
  }, [school]);

  useEffect(() => { load(); }, [school]);

  const handleSave = async () => {
    if (!school) return;
    setSaving(true);
    try {
      if (tab === 'routes') {
        if (!routeForm.route_name) { showAlert('Missing Fields', 'Route name is required.'); setSaving(false); return; }
        const { error } = await createRoute(school.id, {
          route_name: routeForm.route_name,
          route_code: routeForm.route_code || undefined,
          start_point: routeForm.start_point || undefined,
          end_point: routeForm.end_point || undefined,
          fee: routeForm.fee ? parseFloat(routeForm.fee) : 0,
        });
        if (error) { showAlert('Error', error); return; }
        setRouteForm({ route_name: '', route_code: '', start_point: '', end_point: '', fee: '' });
      } else if (tab === 'vehicles') {
        if (!vehicleForm.registration_number) { showAlert('Missing Fields', 'Registration number is required.'); setSaving(false); return; }
        const { error } = await createVehicle(school.id, {
          registration_number: vehicleForm.registration_number,
          make: vehicleForm.make || undefined,
          model: vehicleForm.model || undefined,
          capacity: vehicleForm.capacity ? parseInt(vehicleForm.capacity, 10) : undefined,
        });
        if (error) { showAlert('Error', error); return; }
        setVehicleForm({ registration_number: '', make: '', model: '', capacity: '30' });
      } else if (tab === 'drivers') {
        if (!driverForm.full_name) { showAlert('Missing Fields', 'Driver name is required.'); setSaving(false); return; }
        const { error } = await createDriver(school.id, {
          full_name: driverForm.full_name,
          license_number: driverForm.license_number || undefined,
          phone: driverForm.phone || undefined,
        });
        if (error) { showAlert('Error', error); return; }
        setDriverForm({ full_name: '', license_number: '', phone: '' });
      }
      setShowModal(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen message="Loading transport..." />;

  const openModal = () => {
    if (tab === 'dashboard') {
      setTab('routes');
    }
    setShowModal(true);
  };

  return (
    <View style={styles.flex}>
      <Header
        title="Transport"
        subtitle={school?.name}
        showBack
        accentColor={Colors.secondary}
        rightAction={tab !== 'dashboard' ? { icon: 'add', onPress: openModal } : undefined}
      />
      {/* Tab row */}
      <View style={styles.tabRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {TABS.map((t) => (
            <Pressable key={t.id} style={[styles.tabBtn, tab === t.id && styles.tabBtnActive]} onPress={() => setTab(t.id)}>
              <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {tab === 'dashboard' ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={undefined}
        >
          <View style={styles.statsRow}>
            <StatCard label="Routes" value={stats?.totalRoutes ?? 0} icon="route" color={Colors.primary} subtitle={`${stats?.activeRoutes ?? 0} active`} />
            <StatCard label="Vehicles" value={stats?.totalVehicles ?? 0} icon="directions-bus" color={Colors.secondary} subtitle={`${stats?.activeVehicles ?? 0} active`} />
          </View>
          <View style={styles.statsRow}>
            <StatCard label="Drivers" value={stats?.totalDrivers ?? 0} icon="badge" color={Colors.teacher} />
            <StatCard label="Assigned" value={stats?.assignedStudents ?? 0} icon="people" color={Colors.success} subtitle="students" />
          </View>
          {stats && stats.expiringInsuranceSoon > 0 ? (
            <Card style={styles.warnBanner}>
              <MaterialIcons name="warning" size={20} color={Colors.warning} />
              <Text style={styles.warnText}>{stats.expiringInsuranceSoon} vehicle(s) have insurance expiring within 30 days.</Text>
            </Card>
          ) : null}
          <Text style={styles.sectionTitle}>Quick Tips</Text>
          <Card>
            <Text style={styles.tipText}>• Use the Routes tab to define pickup/drop routes with fees.</Text>
            <Text style={styles.tipText}>• Register vehicles under the Vehicles tab with capacity & insurance info.</Text>
            <Text style={styles.tipText}>• Add drivers and link them to vehicles in the Drivers tab.</Text>
          </Card>
        </ScrollView>
      ) : (
        <FlatList
          data={tab === 'routes' ? routes : tab === 'vehicles' ? vehicles : drivers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
          ListEmptyComponent={
            <EmptyState
              icon={tab === 'routes' ? 'route' : tab === 'vehicles' ? 'directions-bus' : 'badge'}
              title={`No ${tab.charAt(0).toUpperCase() + tab.slice(1)} Yet`}
              description={`Tap + to add your first ${tab.slice(0, -1)}.`}
              actionLabel={`Add ${tab.slice(0, -1)}`}
              onAction={openModal}
            />
          }
          renderItem={({ item }) => {
            if (tab === 'routes') {
              const r = item as TransportRoute;
              return (
                <Card>
                  <View style={styles.itemRow}>
                    <View style={[styles.itemIcon, { backgroundColor: Colors.schoolAdminBg }]}>
                      <MaterialIcons name="route" size={20} color={Colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{r.route_name}</Text>
                      <Text style={styles.itemSub}>{[r.route_code, r.start_point && `From ${r.start_point}`, r.end_point && `To ${r.end_point}`].filter(Boolean).join(' • ') || 'No route details'}</Text>
                      {r.fee > 0 ? <Text style={styles.itemFee}>{formatCurrency(r.fee)} / term</Text> : null}
                    </View>
                    {r.is_active ? <Badge label="Active" variant="success" size="sm" /> : <Badge label="Inactive" variant="default" size="sm" />}
                  </View>
                </Card>
              );
            }
            if (tab === 'vehicles') {
              const v = item as TransportVehicle & { transport_routes?: { route_name: string } | null };
              return (
                <Card>
                  <View style={styles.itemRow}>
                    <View style={[styles.itemIcon, { backgroundColor: Colors.infoBg }]}>
                      <MaterialIcons name="directions-bus" size={20} color={Colors.info} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{v.registration_number}</Text>
                      <Text style={styles.itemSub}>{[v.make, v.model, v.year].filter(Boolean).join(' ') || 'No vehicle details'}</Text>
                      <Text style={styles.itemSub}>Capacity: {v.capacity} • {v.transport_routes?.route_name ? `Route: ${v.transport_routes.route_name}` : 'No route assigned'}</Text>
                    </View>
                    {v.is_active ? <Badge label="Active" variant="success" size="sm" /> : <Badge label="Inactive" variant="default" size="sm" />}
                  </View>
                </Card>
              );
            }
            // drivers
            const d = item as TransportDriver;
            return (
              <Card>
                <View style={styles.itemRow}>
                  <View style={[styles.itemIcon, { backgroundColor: Colors.teacherBg }]}>
                    <MaterialIcons name="badge" size={20} color={Colors.teacher} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{d.full_name}</Text>
                    <Text style={styles.itemSub}>{d.license_number ? `License: ${d.license_number}` : 'No license on file'}</Text>
                    {d.phone ? <Text style={styles.itemSub}>{d.phone}</Text> : null}
                  </View>
                  {d.is_active ? <Badge label="Active" variant="success" size="sm" /> : <Badge label="Inactive" variant="default" size="sm" />}
                </View>
              </Card>
            );
          }}
        />
      )}

      {/* Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add {tab === 'routes' ? 'Route' : tab === 'vehicles' ? 'Vehicle' : 'Driver'}</Text>
              <Pressable onPress={() => setShowModal(false)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {tab === 'routes' && (
                <>
                  <Field label="Route Name *" value={routeForm.route_name} onChangeText={(v) => setRouteForm((f) => ({ ...f, route_name: v }))} placeholder="e.g., Riverside Route" />
                  <Field label="Route Code" value={routeForm.route_code} onChangeText={(v) => setRouteForm((f) => ({ ...f, route_code: v }))} placeholder="e.g., RR-01" />
                  <Field label="Start Point" value={routeForm.start_point} onChangeText={(v) => setRouteForm((f) => ({ ...f, start_point: v }))} placeholder="e.g., Town Center" />
                  <Field label="End Point" value={routeForm.end_point} onChangeText={(v) => setRouteForm((f) => ({ ...f, end_point: v }))} placeholder="e.g., School Gate" />
                  <Field label="Fee (KES)" value={routeForm.fee} onChangeText={(v) => setRouteForm((f) => ({ ...f, fee: v }))} placeholder="5000" keyboard="numeric" />
                </>
              )}
              {tab === 'vehicles' && (
                <>
                  <Field label="Registration Number *" value={vehicleForm.registration_number} onChangeText={(v) => setVehicleForm((f) => ({ ...f, registration_number: v }))} placeholder="KDA 123A" />
                  <Field label="Make" value={vehicleForm.make} onChangeText={(v) => setVehicleForm((f) => ({ ...f, make: v }))} placeholder="Toyota" />
                  <Field label="Model" value={vehicleForm.model} onChangeText={(v) => setVehicleForm((f) => ({ ...f, model: v }))} placeholder="Coaster" />
                  <Field label="Capacity" value={vehicleForm.capacity} onChangeText={(v) => setVehicleForm((f) => ({ ...f, capacity: v }))} placeholder="30" keyboard="numeric" />
                </>
              )}
              {tab === 'drivers' && (
                <>
                  <Field label="Full Name *" value={driverForm.full_name} onChangeText={(v) => setDriverForm((f) => ({ ...f, full_name: v }))} placeholder="John Doe" />
                  <Field label="License Number" value={driverForm.license_number} onChangeText={(v) => setDriverForm((f) => ({ ...f, license_number: v }))} placeholder="DL-123456" />
                  <Field label="Phone" value={driverForm.phone} onChangeText={(v) => setDriverForm((f) => ({ ...f, phone: v }))} placeholder="+254..." keyboard="phone-pad" />
                </>
              )}
              <Button label={saving ? 'Saving...' : 'Save'} onPress={handleSave} loading={saving} fullWidth style={{ marginTop: Spacing.md, marginBottom: Spacing.lg }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboard }: { label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; keyboard?: 'numeric' | 'phone-pad' }) {
  return (
    <View style={{ marginBottom: Spacing.sm }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        keyboardType={keyboard || 'default'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  tabRow: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  tabScroll: { gap: Spacing.xs },
  tabBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: BorderRadius.full, backgroundColor: Colors.surface2, marginRight: Spacing.xs },
  tabBtnActive: { backgroundColor: Colors.secondary },
  tabText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  tabTextActive: { color: Colors.textPrimary },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl, gap: Spacing.sm },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginTop: Spacing.sm, marginBottom: Spacing.xs },
  warnBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.warningBg, borderColor: `${Colors.warning}30` },
  warnText: { flex: 1, fontSize: FontSize.sm, color: Colors.warning, fontWeight: FontWeight.medium },
  tipText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 22, marginBottom: 4 },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  itemIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  itemSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  itemFee: { fontSize: FontSize.xs, color: Colors.success, fontWeight: FontWeight.semibold, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  fieldLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium, marginBottom: 4 },
  input: { backgroundColor: Colors.surface2, borderRadius: BorderRadius.md, padding: Spacing.md, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
});
