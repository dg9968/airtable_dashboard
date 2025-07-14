import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, DollarSign, AlertCircle, CheckCircle, Users, Filter } from 'lucide-react';

// Types
interface TeamMember {
  id: string;
  name: string;
  role: string;
  specialties: string[];
  avatar: string;
  workload: number; // 0-100
  hourlyRate: number;
}

interface TaskItem {
  id: string;
  title: string;
  description: string;
  serviceType: string;
  clientName: string;
  assignedTo: string | null;
  budget: number;
  budgetUsed: number;
  dueDate: Date;
  startDate: Date;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in-progress' | 'completed' | 'overdue';
  estimatedHours: number;
  dependencies: string[];
  tags: string[];
}

interface ServiceType {
  id: string;
  name: string;
  color: string;
  icon: string;
  requiredSkills: string[];
}

const TaskCalendarAssignment = () => {
  // State
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewType, setViewType] = useState<'month' | 'week' | 'timeline' | 'workload'>('month');
  const [filterService, setFilterService] = useState<string>('all');
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [draggedTask, setDraggedTask] = useState<TaskItem | null>(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  // Service types
  const serviceTypes: ServiceType[] = [
    { id: 'bookkeeping', name: 'Bookkeeping', color: 'bg-blue-500', icon: '📊', requiredSkills: ['accounting', 'quickbooks'] },
    { id: 'tax-prep', name: 'Tax Preparation', color: 'bg-green-500', icon: '📋', requiredSkills: ['tax-law', 'irs-forms'] },
    { id: 'payroll', name: 'Payroll', color: 'bg-purple-500', icon: '💰', requiredSkills: ['payroll-systems', 'compliance'] },
    { id: 'consulting', name: 'Business Consulting', color: 'bg-orange-500', icon: '🤝', requiredSkills: ['business-analysis', 'strategy'] },
    { id: 'audit', name: 'Audit Support', color: 'bg-red-500', icon: '🔍', requiredSkills: ['auditing', 'compliance'] }
  ];

  // Mock data initialization
  useEffect(() => {
    const mockTeamMembers: TeamMember[] = [
      {
        id: '1',
        name: 'Sarah Johnson',
        role: 'Senior Accountant',
        specialties: ['accounting', 'quickbooks', 'tax-law'],
        avatar: '👩‍💼',
        workload: 75,
        hourlyRate: 65
      },
      {
        id: '2',
        name: 'Mike Chen',
        role: 'Tax Specialist',
        specialties: ['tax-law', 'irs-forms', 'compliance'],
        avatar: '👨‍💼',
        workload: 60,
        hourlyRate: 70
      },
      {
        id: '3',
        name: 'Lisa Rodriguez',
        role: 'Bookkeeper',
        specialties: ['bookkeeping', 'payroll-systems', 'quickbooks'],
        avatar: '👩‍💻',
        workload: 45,
        hourlyRate: 45
      },
      {
        id: '4',
        name: 'David Kim',
        role: 'Business Consultant',
        specialties: ['business-analysis', 'strategy', 'auditing'],
        avatar: '👨‍🎓',
        workload: 80,
        hourlyRate: 85
      }
    ];

    const mockTasks: TaskItem[] = [
      {
        id: '1',
        title: 'Monthly Bookkeeping - ABC Corp',
        description: 'Complete monthly reconciliation and financial statements',
        serviceType: 'bookkeeping',
        clientName: 'ABC Corp',
        assignedTo: '1',
        budget: 1500,
        budgetUsed: 800,
        dueDate: new Date(2025, 6, 20),
        startDate: new Date(2025, 6, 15),
        priority: 'high',
        status: 'in-progress',
        estimatedHours: 20,
        dependencies: [],
        tags: ['monthly', 'reconciliation']
      },
      {
        id: '2',
        title: 'Q2 Tax Filing - XYZ LLC',
        description: 'Prepare and file quarterly tax returns',
        serviceType: 'tax-prep',
        clientName: 'XYZ LLC',
        assignedTo: null,
        budget: 2000,
        budgetUsed: 0,
        dueDate: new Date(2025, 6, 25),
        startDate: new Date(2025, 6, 18),
        priority: 'high',
        status: 'pending',
        estimatedHours: 15,
        dependencies: ['1'],
        tags: ['quarterly', 'filing']
      },
      {
        id: '3',
        title: 'Payroll Processing - Tech Startup',
        description: 'Process bi-weekly payroll for 25 employees',
        serviceType: 'payroll',
        clientName: 'Tech Startup Inc',
        assignedTo: '3',
        budget: 800,
        budgetUsed: 400,
        dueDate: new Date(2025, 6, 22),
        startDate: new Date(2025, 6, 21),
        priority: 'medium',
        status: 'in-progress',
        estimatedHours: 8,
        dependencies: [],
        tags: ['bi-weekly', 'payroll']
      },
      {
        id: '4',
        title: 'Business Strategy Review',
        description: 'Quarterly business performance analysis',
        serviceType: 'consulting',
        clientName: 'Growth Co',
        assignedTo: null,
        budget: 3000,
        budgetUsed: 0,
        dueDate: new Date(2025, 6, 30),
        startDate: new Date(2025, 6, 25),
        priority: 'low',
        status: 'pending',
        estimatedHours: 25,
        dependencies: [],
        tags: ['quarterly', 'strategy']
      }
    ];

    setTeamMembers(mockTeamMembers);
    setTasks(mockTasks);
  }, []);

  // Utility functions
  const getServiceType = (serviceId: string) => 
    serviceTypes.find(s => s.id === serviceId) || serviceTypes[0];

  const getTeamMember = (memberId: string) => 
    teamMembers.find(m => m.id === memberId);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-red-500 bg-red-50';
      case 'medium': return 'border-yellow-500 bg-yellow-50';
      case 'low': return 'border-green-500 bg-green-50';
      default: return 'border-gray-500 bg-gray-50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in-progress': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Filter functions
  const filteredTasks = tasks.filter(task => {
    const serviceMatch = filterService === 'all' || task.serviceType === filterService;
    const teamMatch = filterTeam === 'all' || task.assignedTo === filterTeam;
    return serviceMatch && teamMatch;
  });

  // Assignment functions
  const handleTaskAssignment = (taskId: string, memberId: string) => {
    setTasks(prevTasks => 
      prevTasks.map(task => 
        task.id === taskId 
          ? { ...task, assignedTo: memberId, status: 'in-progress' as const }
          : task
      )
    );
  };

  const handleTaskDragStart = (task: TaskItem) => {
    setDraggedTask(task);
  };

  const handleMemberDrop = (memberId: string) => {
    if (draggedTask) {
      handleTaskAssignment(draggedTask.id, memberId);
      setDraggedTask(null);
    }
  };

  const openAssignmentModal = (task: TaskItem) => {
    setSelectedTask(task);
    setShowAssignmentModal(true);
  };

  const getSuggestedAssignees = (task: TaskItem) => {
    const serviceType = getServiceType(task.serviceType);
    return teamMembers
      .filter(member => 
        serviceType.requiredSkills.some(skill => member.specialties.includes(skill))
      )
      .sort((a, b) => a.workload - b.workload);
  };

  // Calendar generation
  const generateCalendarDays = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const current = new Date(startDate);
    
    for (let i = 0; i < 42; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  };

  const getTasksForDate = (date: Date) => {
    return filteredTasks.filter(task => {
      const taskDate = new Date(task.dueDate);
      return taskDate.toDateString() === date.toDateString();
    });
  };

  // Component renders
  const TaskCard = ({ task }: { task: TaskItem }) => {
    const serviceType = getServiceType(task.serviceType);
    const assignedMember = task.assignedTo ? getTeamMember(task.assignedTo) : null;
    
    return (
      <div
        className={`p-3 rounded-lg border-l-4 ${getPriorityColor(task.priority)} cursor-pointer hover:shadow-md transition-shadow`}
        draggable
        onDragStart={() => handleTaskDragStart(task)}
        onClick={() => openAssignmentModal(task)}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">{serviceType.icon}</span>
            <h4 className="font-medium text-sm truncate">{task.title}</h4>
          </div>
          <span className={`px-2 py-1 rounded text-xs ${getStatusColor(task.status)}`}>
            {task.status}
          </span>
        </div>
        
        <p className="text-xs text-gray-600 mb-2">{task.clientName}</p>
        
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            <span>${task.budget}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{task.estimatedHours}h</span>
          </div>
        </div>
        
        {assignedMember && (
          <div className="mt-2 flex items-center gap-1">
            <span className="text-xs">{assignedMember.avatar}</span>
            <span className="text-xs text-gray-600">{assignedMember.name}</span>
          </div>
        )}
      </div>
    );
  };

  const TeamMemberCard = ({ member }: { member: TeamMember }) => (
    <div
      className="p-4 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow"
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => handleMemberDrop(member.id)}
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{member.avatar}</span>
        <div>
          <h3 className="font-medium text-sm">{member.name}</h3>
          <p className="text-xs text-gray-600">{member.role}</p>
        </div>
      </div>
      
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>Workload</span>
          <span>{member.workload}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${
              member.workload > 80 ? 'bg-red-500' : 
              member.workload > 60 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${member.workload}%` }}
          />
        </div>
      </div>
      
      <div className="text-xs text-gray-600">
        <p className="mb-1">Specialties:</p>
        <div className="flex flex-wrap gap-1">
          {member.specialties.map(skill => (
            <span key={skill} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
              {skill}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  const AssignmentModal = () => {
    if (!selectedTask) return null;
    
    const suggestedAssignees = getSuggestedAssignees(selectedTask);
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Assign Task</h2>
            <button
              onClick={() => setShowAssignmentModal(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>
          
          <div className="mb-4">
            <h3 className="font-medium mb-2">{selectedTask.title}</h3>
            <p className="text-sm text-gray-600 mb-2">{selectedTask.description}</p>
            <div className="flex gap-4 text-sm text-gray-500">
              <span>Client: {selectedTask.clientName}</span>
              <span>Budget: ${selectedTask.budget}</span>
              <span>Hours: {selectedTask.estimatedHours}h</span>
            </div>
          </div>
          
          <div className="mb-4">
            <h4 className="font-medium mb-2">Suggested Assignees</h4>
            <div className="space-y-2">
              {suggestedAssignees.map(member => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    handleTaskAssignment(selectedTask.id, member.id);
                    setShowAssignmentModal(false);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{member.avatar}</span>
                    <div>
                      <p className="font-medium">{member.name}</p>
                      <p className="text-sm text-gray-600">{member.role}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Workload: {member.workload}%</p>
                    <p className="text-sm text-gray-600">${member.hourlyRate}/hr</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAssignmentModal(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Task Calendar & Assignment</h1>
          <p className="text-gray-600">Manage service tasks and team assignments</p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex gap-2">
              {['month', 'week', 'timeline', 'workload'].map(view => (
                <button
                  key={view}
                  onClick={() => setViewType(view as any)}
                  className={`px-3 py-1 rounded text-sm capitalize ${
                    viewType === view 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {view}
                </button>
              ))}
            </div>
            
            <div className="flex gap-2">
              <select
                value={filterService}
                onChange={(e) => setFilterService(e.target.value)}
                className="px-3 py-1 border rounded text-sm"
              >
                <option value="all">All Services</option>
                {serviceTypes.map(service => (
                  <option key={service.id} value={service.id}>{service.name}</option>
                ))}
              </select>
              
              <select
                value={filterTeam}
                onChange={(e) => setFilterTeam(e.target.value)}
                className="px-3 py-1 border rounded text-sm"
              >
                <option value="all">All Team Members</option>
                {teamMembers.map(member => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Calendar View */}
          <div className="lg:col-span-3">
            {viewType === 'month' && (
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">
                    {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1))}
                      className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setSelectedDate(new Date())}
                      className="px-3 py-1 bg-blue-500 text-white hover:bg-blue-600 rounded text-sm"
                    >
                      Today
                    </button>
                    <button
                      onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1))}
                      className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
                    >
                      Next
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                      {day}
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-7 gap-1">
                  {generateCalendarDays().map((day, index) => {
                    const dayTasks = getTasksForDate(day);
                    const isCurrentMonth = day.getMonth() === selectedDate.getMonth();
                    const isToday = day.toDateString() === new Date().toDateString();
                    
                    return (
                      <div
                        key={index}
                        className={`min-h-[120px] p-2 border ${
                          isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                        } ${isToday ? 'bg-blue-50 border-blue-200' : 'border-gray-200'}`}
                      >
                        <div className={`text-sm font-medium mb-1 ${
                          isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                        }`}>
                          {day.getDate()}
                        </div>
                        <div className="space-y-1">
                          {dayTasks.map(task => (
                            <TaskCard key={task.id} task={task} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {viewType === 'workload' && (
              <div className="bg-white rounded-lg shadow-sm p-4">
                <h2 className="text-lg font-semibold mb-4">Team Workload Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {teamMembers.map(member => (
                    <TeamMemberCard key={member.id} member={member} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Unassigned Tasks */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                Unassigned Tasks
              </h3>
              <div className="space-y-2">
                {filteredTasks.filter(task => !task.assignedTo).map(task => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold mb-3">Quick Stats</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total Tasks</span>
                  <span className="font-medium">{filteredTasks.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Unassigned</span>
                  <span className="font-medium text-orange-600">
                    {filteredTasks.filter(t => !t.assignedTo).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>In Progress</span>
                  <span className="font-medium text-blue-600">
                    {filteredTasks.filter(t => t.status === 'in-progress').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Completed</span>
                  <span className="font-medium text-green-600">
                    {filteredTasks.filter(t => t.status === 'completed').length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Assignment Modal */}
      {showAssignmentModal && <AssignmentModal />}
    </div>
  );
};

export default TaskCalendarAssignment;