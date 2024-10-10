import { Request, Response } from 'express';
import { RequestSerice } from '../services/request.service';
import { CreateProjectRequest, GenerateTokenProps } from '../types';
import { ProjectService } from '../services/project.service';
import ApiStatus from '../handlers/api.handler';

export class RequestController {
	static async getUserRequests(req: Request, res: Response) {
		try {
			const { id } = req.params;

			const requests = await RequestSerice.getUserRequests(id);

			return res.status(200).json({
				...requests,
			});
		} catch (e) {
			return res.status(500).json({
				message: (e as Error).message,
			});
		}
	}

	static async getProjectRequests(req: Request, res: Response) {
		try {
			//@ts-ignore
			const user = req.user as GenerateTokenProps;

			const { id } = req.params;

			const project = await ProjectService.getProject(id);

			if (!project) {
				throw ApiStatus.pageNotFound('Project not found');
			}

			if (project.managerId !== user.id) {
				throw ApiStatus.forbidden('Forbidden');
			}

			const requests = await RequestSerice.getProjectRequests(id);

			return res.status(200).json({
				requests,
			});
		} catch (e) {
			return res.status(500).json({
				message: (e as Error).message,
			});
		}
	}

	static async updateRequestsPriority(
		req: Request<never, never, Array<{ id: string; priority: number }>>,
		res: Response
	) {
		try {
			//@ts-ignore
			const user = req.user as GenerateTokenProps;

			const forUpdate = req.body;

			const requests = await RequestSerice.setPriority(forUpdate);

			return res.status(200).json({
				...requests,
			});
		} catch (e) {
			return res.status(500).json({
				message: (e as Error).message,
			});
		}
	}

	static async createRequest(
		req: Request<never, never, Pick<CreateProjectRequest, 'priority'>>,
		res: Response
	) {
		try {
			//@ts-ignore
			const user = req.user as GenerateTokenProps;

			const { projectId } = req.params;

			const requests = await RequestSerice.createRequest({
				userId: user.id,
				priority: 1,
				projectId: projectId,
			});

			return res.status(200).json({
				...requests,
			});
		} catch (e) {
			return res.status(500).json({
				message: (e as Error).message,
			});
		}
	}

	static async cancelRequest(req: Request, res: Response) {
		try {
			const { id } = req.params;

			const request = await RequestSerice.updateRequest(id, 'rejected');

			return res.status(200).json({
				...request,
			});
		} catch (e) {
			return res.status(500).json({
				message: (e as Error).message,
			});
		}
	}

	static async approveRequest(req: Request, res: Response) {
		try {
			//@ts-ignore
			const user = req.user as GenerateTokenProps;

			const { id } = req.params;

			await RequestSerice.updateRequest(id, 'confirmed');

			const request = await RequestSerice.getRequest(id);

			if (!request) throw ApiStatus.badRequest('Request not found');

			const project = await ProjectService.getProject(request.projectId);

			if (!project) throw ApiStatus.badRequest('Project not found');

			const totalTeammates = (
				await ProjectService.getProjectUsers(request.projectId)
			).length;

			if (totalTeammates + 1 > project.maxUserNum)
				throw ApiStatus.badRequest('Limit reached');

			await ProjectService.addTeamMember(request.userId, request.projectId);

			return res.status(200).json({
				...request,
			});
		} catch (e) {
			return res.status(500).json({
				message: (e as Error).message,
			});
		}
	}
}